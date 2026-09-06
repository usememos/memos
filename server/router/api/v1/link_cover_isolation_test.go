package v1

import (
	"context"
	"os"
	"sync"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/httpgetter"
	"github.com/usememos/memos/internal/testutil/fakes3"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

type coverFailureDriver struct {
	store.Driver
	failure   string
	candidate *store.Attachment
}

func (d *coverFailureDriver) CreateAttachment(ctx context.Context, attachment *store.Attachment) (*store.Attachment, error) {
	d.candidate = attachment
	if d.failure == "create" {
		return nil, errors.New("injected attachment failure")
	}
	return d.Driver.CreateAttachment(ctx, attachment)
}

func (d *coverFailureDriver) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	if d.failure == "cas" {
		return store.ErrMemoConcurrentUpdate
	}
	return d.Driver.UpdateMemo(ctx, update)
}

func TestCoverRepairKeepsSharedStorageImmutable(t *testing.T) {
	for _, storageType := range []string{"local", "s3"} {
		for _, failure := range []string{"success", "create", "cas"} {
			t.Run(storageType+"/"+failure, func(t *testing.T) {
				ctx := context.Background()
				const page = "https://example.com/page"
				const imageURL = "https://example.com/image.png"
				service := newLinkEnrichmentTestService(t, stubFetchResults{images: map[string]*httpgetter.Image{
					imageURL: {Blob: validCoverPNG, Mediatype: "image/png"},
				}})
				originalStore := service.Store
				t.Cleanup(func() { require.NoError(t, originalStore.Close()) })
				configured := &storepb.Storage{Id: "covers", Name: "covers", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}
				var fake *fakes3.Server
				if storageType == "s3" {
					fake = fakes3.New(t, "covers")
					configured.Type = storepb.StorageType_STORAGE_TYPE_S3
					configured.Config = &storepb.Storage_S3Config{S3Config: fake.Config("covers")}
				}
				_, err := service.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
					Key: storepb.InstanceSettingKey_STORAGE,
					Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
						FilepathTemplate: "{filename}", Storages: []*storepb.Storage{configured}, DefaultStorageId: configured.Id,
					}},
				})
				require.NoError(t, err)
				user, err := service.Store.CreateUser(ctx, &store.User{Username: "cover-owner", Role: store.RoleUser, PasswordHash: "hash"})
				require.NoError(t, err)
				old := &store.Attachment{UID: shortuuid.New(), CreatorID: user.ID, Filename: coverFilename(page, imageURL), Blob: []byte("broken old cover"), Type: "image/png", Size: 16}
				require.NoError(t, SaveAttachmentBlob(ctx, service.Profile, service.Store, old))
				old, err = service.Store.CreateAttachment(ctx, old)
				require.NoError(t, err)
				read := func(attachment *store.Attachment) []byte {
					t.Helper()
					var blob []byte
					var err error
					if fake != nil {
						blob, err = fake.GetObject("covers", attachment.Payload.GetS3Object().Key)
					} else {
						blob, err = os.ReadFile(attachment.Reference)
					}
					require.NoError(t, err)
					return blob
				}
				key := func(attachment *store.Attachment) string {
					if fake != nil {
						return attachment.Payload.GetS3Object().Key
					}
					return attachment.Reference
				}
				memos := make([]*store.Memo, 2)
				for i := range memos {
					memos[i], err = service.Store.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: page, Visibility: store.Private,
						Payload: &storepb.MemoPayload{Property: &storepb.MemoPayload_Property{HasLink: true}, Links: []*storepb.MemoPayload_LinkMetadata{{Url: page, Image: imageURL, CoverAttachmentUid: old.UID}}},
					})
					require.NoError(t, err)
				}
				driver := &coverFailureDriver{Driver: originalStore.GetDriver(), failure: failure}
				service.Store = store.New(driver, service.Profile)
				response, err := service.RefreshMemoLinkCovers(context.WithValue(ctx, auth.UserIDContextKey, user.ID), &v1pb.RefreshMemoLinkCoversRequest{PageSize: 1})
				require.NoError(t, err)
				require.NotNil(t, driver.candidate)
				require.NotEqual(t, key(old), key(driver.candidate))
				require.Equal(t, []byte("broken old cover"), read(old))
				require.Equal(t, validCoverPNG, read(driver.candidate))
				for i, memo := range memos {
					persisted, err := originalStore.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
					require.NoError(t, err)
					if i == 0 && failure == "success" {
						require.Equal(t, driver.candidate.UID, persisted.Payload.Links[0].CoverAttachmentUid)
					} else {
						require.Equal(t, old.UID, persisted.Payload.Links[0].CoverAttachmentUid)
					}
				}
				switch failure {
				case "success":
					require.Equal(t, int32(1), response.UpdatedLinks)
				case "create":
					require.Equal(t, int32(1), response.FailedLinks)
				case "cas":
					require.Equal(t, int32(1), response.SkippedLinks)
				}
				// Simultaneous uploads with a filename-only template cannot target one another.
				candidates := make([]*store.Attachment, 2)
				errs := make([]error, 2)
				var group sync.WaitGroup
				for i := range candidates {
					candidates[i] = &store.Attachment{UID: shortuuid.New(), Filename: old.Filename, Type: "image/png", Blob: validCoverPNG}
					group.Go(func() { errs[i] = saveLinkCoverCandidateBlob(ctx, service.Profile, originalStore, candidates[i]) })
				}
				group.Wait()
				for i := range candidates {
					require.NoError(t, errs[i])
					require.NotEqual(t, key(old), key(candidates[i]))
					require.Equal(t, validCoverPNG, read(candidates[i]))
				}
				require.NotEqual(t, key(candidates[0]), key(candidates[1]))
				require.Equal(t, []byte("broken old cover"), read(old))
			})
		}
	}
}

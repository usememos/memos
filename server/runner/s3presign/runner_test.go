package s3presign

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/storage/s3"
	"github.com/usememos/memos/internal/testutil/fakes3"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestCheckAndPresignRefreshesAndPinsAttachments(t *testing.T) {
	ctx := context.Background()
	fake := fakes3.New(t, "presign-attachments")
	config := fake.Config("presign-attachments")
	ts := teststore.NewTestingStore(ctx, t)
	defer ts.Close()

	storageID := "s3-current"
	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			Storages: []*storepb.Storage{{
				Id:     storageID,
				Name:   "Current S3",
				Type:   storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: config},
			}},
			DefaultStorageId: storageID,
		}},
	})
	require.NoError(t, err)
	user, err := ts.CreateUser(ctx, &store.User{
		Username: "presign-runner-user",
		Role:     store.RoleUser,
		Email:    "presign-runner-user@example.com",
	})
	require.NoError(t, err)

	driver, err := s3.NewDriver(ctx, config)
	require.NoError(t, err)
	content := []byte("legacy attachment refreshed by the runner")
	legacyKey, err := driver.UploadObject(ctx, "legacy/presign.txt", "text/plain", bytes.NewReader(content))
	require.NoError(t, err)

	freshTime := timestamppb.Now()
	createS3Attachment(ctx, t, ts, user.ID, "presign-legacy", legacyKey, "", config, nil, "")
	createS3Attachment(ctx, t, ts, user.ID, "presign-expired", "expired.txt", storageID, nil, timestamppb.New(time.Now().Add(-5*24*time.Hour)), "expired-reference")
	createS3Attachment(ctx, t, ts, user.ID, "presign-fresh", "fresh.txt", storageID, nil, freshTime, "still-valid-reference")
	createS3Attachment(ctx, t, ts, user.ID, "presign-dangling", "dangling.txt", "missing-storage", nil, nil, "dangling-reference")

	NewRunner(ts).RunOnce(ctx)

	legacy := getAttachmentByUID(ctx, t, ts, "presign-legacy")
	require.Equal(t, storageID, legacy.Payload.GetS3Object().GetStorageId())
	require.NotNil(t, legacy.Payload.GetS3Object().GetLastPresignedTime())
	require.Contains(t, legacy.Reference, "X-Amz-Signature=")
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, legacy.Reference, nil)
	require.NoError(t, err)
	response, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	downloaded, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.Equal(t, content, downloaded)

	expired := getAttachmentByUID(ctx, t, ts, "presign-expired")
	require.NotEqual(t, "expired-reference", expired.Reference)
	require.Contains(t, expired.Reference, "X-Amz-Signature=")
	require.True(t, expired.Payload.GetS3Object().GetLastPresignedTime().AsTime().After(time.Now().Add(-time.Minute)))

	fresh := getAttachmentByUID(ctx, t, ts, "presign-fresh")
	require.Equal(t, "still-valid-reference", fresh.Reference)
	require.Equal(t, freshTime.AsTime(), fresh.Payload.GetS3Object().GetLastPresignedTime().AsTime())

	fallback := getAttachmentByUID(ctx, t, ts, "presign-dangling")
	require.Contains(t, fallback.Reference, "X-Amz-Signature=")
	require.NotNil(t, fallback.Payload.GetS3Object().GetLastPresignedTime())
	require.Equal(t, "missing-storage", fallback.Payload.GetS3Object().GetStorageId())
}

func TestCheckAndPresignProcessesMultipleBatches(t *testing.T) {
	ctx := context.Background()
	fake := fakes3.New(t, "presign-batches")
	config := fake.Config("presign-batches")
	ts := teststore.NewTestingStore(ctx, t)
	defer ts.Close()

	const storageID = "s3-batches"
	_, err := ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			Storages: []*storepb.Storage{{
				Id:     storageID,
				Name:   "Batch S3",
				Type:   storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: config},
			}},
			DefaultStorageId: storageID,
		}},
	})
	require.NoError(t, err)
	user, err := ts.CreateUser(ctx, &store.User{
		Username: "presign-batch-user",
		Role:     store.RoleUser,
		Email:    "presign-batch-user@example.com",
	})
	require.NoError(t, err)

	for i := 0; i < 101; i++ {
		uid := fmt.Sprintf("presign-batch-%03d", i)
		createS3Attachment(ctx, t, ts, user.ID, uid, uid+".txt", storageID, nil, nil, "")
	}

	NewRunner(ts).RunOnce(ctx)

	s3StorageType := storepb.AttachmentStorageType_S3
	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{StorageType: &s3StorageType, SkipDefaultLimit: true})
	require.NoError(t, err)
	require.Len(t, attachments, 101)
	for _, attachment := range attachments {
		require.Contains(t, attachment.Reference, "X-Amz-Signature=", attachment.UID)
		require.NotNil(t, attachment.Payload.GetS3Object().GetLastPresignedTime(), attachment.UID)
	}
}

func createS3Attachment(
	ctx context.Context,
	t *testing.T,
	ts *store.Store,
	creatorID int32,
	uid string,
	key string,
	storageID string,
	embeddedConfig *storepb.StorageS3Config,
	lastPresignedTime *timestamppb.Timestamp,
	reference string,
) {
	t.Helper()
	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:         uid,
		CreatorID:   creatorID,
		Filename:    uid + ".txt",
		Type:        "text/plain",
		Size:        1,
		StorageType: storepb.AttachmentStorageType_S3,
		Reference:   reference,
		Payload: &storepb.AttachmentPayload{Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				Key:               key,
				StorageId:         storageID,
				S3Config:          embeddedConfig,
				LastPresignedTime: lastPresignedTime,
			},
		}},
	})
	require.NoError(t, err)
}

func getAttachmentByUID(ctx context.Context, t *testing.T, ts *store.Store, uid string) *store.Attachment {
	t.Helper()
	attachment, err := ts.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, attachment)
	return attachment
}

func TestCloneAttachmentPayloadPreservesMotionMedia(t *testing.T) {
	payload := &storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				Key: "photos/live.jpg",
			},
		},
		MotionMedia: &storepb.MotionMedia{
			Family:  storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO,
			Role:    storepb.MotionMediaRole_CONTAINER,
			GroupId: "motion-group",
		},
	}

	cloned := cloneAttachmentPayload(payload)
	require.NotNil(t, cloned)
	require.NotSame(t, payload, cloned)
	require.Equal(t, payload.MotionMedia, cloned.MotionMedia)

	cloned.GetS3Object().LastPresignedTime = timestamppb.Now()
	require.Nil(t, payload.GetS3Object().LastPresignedTime)
	require.Equal(t, "motion-group", cloned.MotionMedia.GroupId)
}

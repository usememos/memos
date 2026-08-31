package test

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/storage/s3"
	"github.com/usememos/memos/internal/testutil/fakes3"
	testminio "github.com/usememos/memos/internal/testutil/minio"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestS3AttachmentLifecycleAcrossStorageChange(t *testing.T) {
	fake := fakes3.New(t, "attachments-old", "attachments-new")
	runS3AttachmentLifecycleAcrossStorageChange(t, fake)
}

func TestS3AttachmentLifecycleAcrossStorageChangeMinIO(t *testing.T) {
	server := testminio.New(t, "attachments-old", "attachments-new")
	runS3AttachmentLifecycleAcrossStorageChange(t, server)
}

type s3ObjectStore interface {
	Config(bucket string) *storepb.StorageS3Config
	GetObject(bucket, key string) ([]byte, error)
}

func runS3AttachmentLifecycleAcrossStorageChange(t *testing.T, objectStore s3ObjectStore) {
	t.Helper()
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "s3-attachment-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	oldStorage := fakeStorage("s3-old", "Old S3", objectStore.Config("attachments-old"))
	upsertS3StorageSetting(ctx, t, ts, oldStorage.Id, oldStorage)

	firstContent := []byte("first attachment in old storage")
	first, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "first.txt",
			Type:     "text/plain",
			Content:  firstContent,
		},
	})
	require.NoError(t, err)

	firstUID, err := apiv1.ExtractAttachmentUIDFromName(first.Name)
	require.NoError(t, err)
	storedFirst, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &firstUID})
	require.NoError(t, err)
	require.NotNil(t, storedFirst)
	require.Equal(t, storepb.AttachmentStorageType_S3, storedFirst.StorageType)
	require.Empty(t, storedFirst.Blob)
	require.Empty(t, storedFirst.Reference, "S3 attachments must not store a reference URL")
	require.Equal(t, oldStorage.Id, storedFirst.Payload.GetS3Object().GetStorageId())
	require.Nil(t, storedFirst.Payload.GetS3Object().GetS3Config(), "new attachments must not embed S3 credentials")

	oldKey := storedFirst.Payload.GetS3Object().GetKey()
	storedInOldBucket, err := objectStore.GetObject("attachments-old", oldKey)
	require.NoError(t, err)
	require.Equal(t, firstContent, storedInOldBucket)
	firstDownloaded, err := ts.Service.GetAttachmentBlob(ctx, storedFirst)
	require.NoError(t, err)
	require.Equal(t, firstContent, firstDownloaded)
	firstMetadata, err := ts.Service.GetAttachment(userCtx, &v1pb.GetAttachmentRequest{Name: first.Name})
	require.NoError(t, err)
	require.Equal(t, first.Name, firstMetadata.Name)
	require.Empty(t, firstMetadata.ExternalLink)

	newStorage := fakeStorage("s3-new", "New S3", objectStore.Config("attachments-new"))
	upsertS3StorageSetting(ctx, t, ts, newStorage.Id, oldStorage, newStorage)

	secondContent := []byte("second attachment in new storage")
	second, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "second.txt",
			Type:     "text/plain",
			Content:  secondContent,
		},
	})
	require.NoError(t, err)
	secondUID, err := apiv1.ExtractAttachmentUIDFromName(second.Name)
	require.NoError(t, err)
	storedSecond, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &secondUID})
	require.NoError(t, err)
	require.Equal(t, newStorage.Id, storedSecond.Payload.GetS3Object().GetStorageId())
	newKey := storedSecond.Payload.GetS3Object().GetKey()
	storedInNewBucket, err := objectStore.GetObject("attachments-new", newKey)
	require.NoError(t, err)
	require.Equal(t, secondContent, storedInNewBucket)

	// Changing the default storage only affects new uploads. The first attachment
	// must continue to resolve its original storage by ID.
	firstDownloaded, err = ts.Service.GetAttachmentBlob(ctx, storedFirst)
	require.NoError(t, err)
	require.Equal(t, firstContent, firstDownloaded)
	secondDownloaded, err := ts.Service.GetAttachmentBlob(ctx, storedSecond)
	require.NoError(t, err)
	require.Equal(t, secondContent, secondDownloaded)

	_, err = ts.Service.DeleteAttachment(userCtx, &v1pb.DeleteAttachmentRequest{Name: first.Name})
	require.NoError(t, err)
	_, err = objectStore.GetObject("attachments-old", oldKey)
	require.Error(t, err, "deleting an attachment must delete its S3 object")
	remaining, err := objectStore.GetObject("attachments-new", newKey)
	require.NoError(t, err)
	require.Equal(t, secondContent, remaining)
}

func TestGetLegacyS3AttachmentBlob(t *testing.T) {
	ctx := context.Background()
	fake := fakes3.New(t, "legacy-fallback", "legacy-current")
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "legacy-s3-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	t.Run("falls back to embedded config when storage is not registered", func(t *testing.T) {
		legacyConfig := fake.Config("legacy-fallback")
		driver, err := s3.NewDriver(ctx, legacyConfig)
		require.NoError(t, err)
		content := []byte("attachment created before storage IDs")
		key, err := driver.UploadObject(ctx, "legacy/fallback.txt", "text/plain", bytes.NewReader(content))
		require.NoError(t, err)

		legacyAttachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
			UID:         "legacy-s3-fallback",
			CreatorID:   user.ID,
			Filename:    "fallback.txt",
			Type:        "text/plain",
			Size:        int64(len(content)),
			StorageType: storepb.AttachmentStorageType_S3,
			Payload: &storepb.AttachmentPayload{
				Payload: &storepb.AttachmentPayload_S3Object_{
					S3Object: &storepb.AttachmentPayload_S3Object{
						S3Config: legacyConfig,
						Key:      key,
					},
				},
			},
		})
		require.NoError(t, err)

		downloaded, err := ts.Service.GetAttachmentBlob(ctx, legacyAttachment)
		require.NoError(t, err)
		require.Equal(t, content, downloaded)
	})

	t.Run("uses current storage options for matching namespace", func(t *testing.T) {
		currentConfig := fake.Config("legacy-current")
		driver, err := s3.NewDriver(ctx, currentConfig)
		require.NoError(t, err)
		content := []byte("legacy attachment using rotated storage config")
		key, err := driver.UploadObject(ctx, "legacy/current.txt", "text/plain", bytes.NewReader(content))
		require.NoError(t, err)
		configuredStorage := fakeStorage("s3-current", "Current S3", currentConfig)
		upsertS3StorageSetting(ctx, t, ts, configuredStorage.Id, configuredStorage)

		// Virtual-hosted addressing cannot resolve against httptest's IP endpoint.
		// Retrieval only succeeds if the legacy namespace is matched to the named
		// storage and its current path-style option is used.
		legacyConfig := &storepb.StorageS3Config{
			AccessKeyId:     "old-access-key",
			AccessKeySecret: "old-secret-key",
			Endpoint:        currentConfig.Endpoint + "/",
			Region:          currentConfig.Region,
			Bucket:          currentConfig.Bucket,
			UsePathStyle:    false,
		}
		legacyAttachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
			UID:         "legacy-s3-current",
			CreatorID:   user.ID,
			Filename:    "current.txt",
			Type:        "text/plain",
			Size:        int64(len(content)),
			StorageType: storepb.AttachmentStorageType_S3,
			Payload: &storepb.AttachmentPayload{
				Payload: &storepb.AttachmentPayload_S3Object_{
					S3Object: &storepb.AttachmentPayload_S3Object{
						S3Config: legacyConfig,
						Key:      key,
					},
				},
			},
		})
		require.NoError(t, err)

		downloaded, err := ts.Service.GetAttachmentBlob(ctx, legacyAttachment)
		require.NoError(t, err)
		require.Equal(t, content, downloaded)

		_, err = ts.Service.DeleteAttachment(userCtx, &v1pb.DeleteAttachmentRequest{Name: apiv1.AttachmentNamePrefix + legacyAttachment.UID})
		require.NoError(t, err)
		_, err = fake.GetObject(currentConfig.Bucket, key)
		require.Error(t, err, "deleting a legacy attachment must use the current matching storage configuration")
	})
}

func fakeStorage(id, name string, config *storepb.StorageS3Config) *storepb.Storage {
	return &storepb.Storage{
		Id:     id,
		Name:   name,
		Type:   storepb.StorageType_STORAGE_TYPE_S3,
		Config: &storepb.Storage_S3Config{S3Config: config},
	}
}

func upsertS3StorageSetting(ctx context.Context, t testing.TB, ts *TestService, defaultStorageID string, storages ...*storepb.Storage) {
	t.Helper()
	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{
			StorageSetting: &storepb.InstanceStorageSetting{
				FilepathTemplate:  "attachments/{uuid}_{filename}",
				UploadSizeLimitMb: 30,
				Storages:          storages,
				DefaultStorageId:  defaultStorageID,
			},
		},
	})
	require.NoError(t, err)
}

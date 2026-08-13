package store_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/storage/s3"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestNormalizeInstanceStorageSettingMigratesLegacyS3Config(t *testing.T) {
	setting := legacyS3StorageSetting("https://s3.example.com", "memos", "secret")

	store.NormalizeInstanceStorageSetting(setting)

	require.Len(t, setting.Storages, 1)
	require.NotEmpty(t, setting.DefaultStorageId)
	configuredStorage := store.GetDefaultStorage(setting)
	require.Equal(t, storepb.StorageType_STORAGE_TYPE_S3, configuredStorage.Type)
	require.Equal(t, setting.DefaultStorageId, configuredStorage.Id)
	require.Equal(t, "secret", configuredStorage.GetS3Config().AccessKeySecret)
	require.NotSame(t, configuredStorage.GetS3Config(), setting.S3Config)
	require.True(t, proto.Equal(configuredStorage.GetS3Config(), setting.S3Config))
}

func TestPrepareInstanceStorageSettingUpdateRotatesCredentialsInPlace(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "memos", "old-secret")
	store.NormalizeInstanceStorageSetting(existing)
	existingID := existing.DefaultStorageId

	incoming := legacyS3StorageSetting("https://s3.example.com/", "memos", "")
	incoming.S3Config.AccessKeyId = "new-access-key"
	require.NoError(t, store.PrepareInstanceStorageSettingUpdate(incoming, existing))

	require.Equal(t, existingID, incoming.DefaultStorageId)
	require.Len(t, incoming.Storages, 1)
	require.Equal(t, "old-secret", store.GetDefaultStorage(incoming).GetS3Config().AccessKeySecret)
}

func TestPrepareInstanceStorageSettingUpdatePreservesPreviousNamespace(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "old-bucket", "secret")
	store.NormalizeInstanceStorageSetting(existing)
	previousID := existing.DefaultStorageId

	incoming := legacyS3StorageSetting("https://s3.example.com", "new-bucket", "")
	require.NoError(t, store.PrepareInstanceStorageSettingUpdate(incoming, existing))

	require.NotEqual(t, previousID, incoming.DefaultStorageId)
	require.Len(t, incoming.Storages, 2)
	require.NotNil(t, store.FindStorage(incoming, previousID))
	require.Equal(t, "old-bucket", store.FindStorage(incoming, previousID).GetS3Config().Bucket)
	require.Equal(t, "new-bucket", store.GetDefaultStorage(incoming).GetS3Config().Bucket)
	require.Equal(t, "secret", store.GetDefaultStorage(incoming).GetS3Config().AccessKeySecret)
}

func TestPrepareInstanceStorageSettingUpdateDoesNotReuseCredentialsAcrossEndpoints(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "old-bucket", "secret")
	store.NormalizeInstanceStorageSetting(existing)

	incomingStorage := s3Storage("new-storage", "new-bucket")
	incomingStorage.GetS3Config().AccessKeyId = "access-key"
	incomingStorage.GetS3Config().Endpoint = "https://other-s3.example.com"
	incoming := &storepb.InstanceStorageSetting{
		DefaultStorageId: incomingStorage.Id,
		Storages:         []*storepb.Storage{incomingStorage},
	}

	// The stored secret must not leak to a different endpoint, and a storage
	// without any recoverable secret must fail loudly instead of persisting
	// empty credentials that break uploads at runtime.
	err := store.PrepareInstanceStorageSettingUpdate(incoming, existing)
	require.ErrorContains(t, err, "access key secret is required")
}

func TestPrepareInstanceStorageSettingUpdateKeepsReferencedDefault(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "memos", "secret")
	store.NormalizeInstanceStorageSetting(existing)
	existingID := existing.DefaultStorageId

	// A default-only request references a storage the server preserves without
	// resending it; the requested default must survive, not reset to local.
	incoming := &storepb.InstanceStorageSetting{DefaultStorageId: existingID}
	require.NoError(t, store.PrepareInstanceStorageSettingUpdate(incoming, existing))

	require.Equal(t, existingID, incoming.DefaultStorageId)
	require.Equal(t, storepb.StorageType_STORAGE_TYPE_S3, store.GetDefaultStorage(incoming).GetType())
	require.Equal(t, "secret", store.GetDefaultStorage(incoming).GetS3Config().AccessKeySecret)

	unknown := &storepb.InstanceStorageSetting{DefaultStorageId: "unknown"}
	err := store.PrepareInstanceStorageSettingUpdate(unknown, existing)
	require.ErrorContains(t, err, `default storage "unknown" is not configured`)
}

func TestPrepareInstanceStorageSettingUpdateKeepsEditedStorageOnIdentityCollision(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "memos", "secret-a")
	store.NormalizeInstanceStorageSetting(existing)
	hashID := existing.DefaultStorageId
	otherStorage := s3Storage("custom-b", "other-bucket")
	otherStorage.GetS3Config().AccessKeyId = "key-b"
	otherStorage.GetS3Config().AccessKeySecret = "secret-b"
	existing.Storages = append(existing.Storages, otherStorage)

	// Editing custom-b onto the first storage's namespace re-identifies it onto
	// the same hash ID; the edited entry must win, not be silently dropped.
	incoming := &storepb.InstanceStorageSetting{
		DefaultStorageId: "custom-b",
		Storages: []*storepb.Storage{
			proto.CloneOf(store.FindStorage(existing, hashID)),
			{
				Id:   "custom-b",
				Name: "Rotated",
				Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
					AccessKeyId:     "key-b-new",
					AccessKeySecret: "secret-b-new",
					Endpoint:        "https://s3.example.com",
					Region:          "us-east-1",
					Bucket:          "memos",
				}},
			},
		},
	}
	require.NoError(t, store.PrepareInstanceStorageSettingUpdate(incoming, existing))

	require.Equal(t, hashID, incoming.DefaultStorageId)
	require.Equal(t, "key-b-new", store.GetDefaultStorage(incoming).GetS3Config().AccessKeyId)
	require.Equal(t, "secret-b-new", store.GetDefaultStorage(incoming).GetS3Config().AccessKeySecret)
	// The other storage's previous identity stays available to attachments.
	require.Equal(t, "other-bucket", store.FindStorage(incoming, "custom-b").GetS3Config().Bucket)
}

func TestPrepareInstanceStorageSettingUpdateDoesNotMutateExistingStorageIdentity(t *testing.T) {
	existing := legacyS3StorageSetting("https://s3.example.com", "old-bucket", "secret")
	store.NormalizeInstanceStorageSetting(existing)
	previousID := existing.DefaultStorageId

	incoming := &storepb.InstanceStorageSetting{
		DefaultStorageId: previousID,
		Storages: []*storepb.Storage{
			{
				Id:   previousID,
				Name: "Replacement",
				Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
					AccessKeyId: "access-key",
					Endpoint:    "https://s3.example.com",
					Region:      "us-east-1",
					Bucket:      "new-bucket",
				}},
			},
		},
	}
	require.NoError(t, store.PrepareInstanceStorageSettingUpdate(incoming, existing))

	require.NotEqual(t, previousID, incoming.DefaultStorageId)
	require.Len(t, incoming.Storages, 2)
	require.Equal(t, "old-bucket", store.FindStorage(incoming, previousID).GetS3Config().Bucket)
}

func TestPrepareInstanceStorageSettingUpdateRejectsInvalidCanonicalRegistry(t *testing.T) {
	t.Run("missing default storage", func(t *testing.T) {
		incoming := &storepb.InstanceStorageSetting{
			DefaultStorageId: "missing",
			Storages: []*storepb.Storage{
				{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL},
			},
		}

		err := store.PrepareInstanceStorageSettingUpdate(incoming, nil)
		require.ErrorContains(t, err, `default storage "missing" is not configured`)
	})

	t.Run("duplicate storage ID", func(t *testing.T) {
		incoming := &storepb.InstanceStorageSetting{
			DefaultStorageId: "duplicate",
			Storages: []*storepb.Storage{
				{Id: "duplicate", Type: storepb.StorageType_STORAGE_TYPE_LOCAL},
				{Id: "duplicate", Type: storepb.StorageType_STORAGE_TYPE_DATABASE},
			},
		}

		err := store.PrepareInstanceStorageSettingUpdate(incoming, nil)
		require.ErrorContains(t, err, `duplicate storage ID "duplicate"`)
	})
}

func TestNormalizeInstanceStorageSettingKeepsMostRecentlyActivatedStorageFirst(t *testing.T) {
	recent := s3Storage("recent", "recent-bucket")
	old := s3Storage("old", "old-bucket")
	local := &storepb.Storage{Id: "local", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}
	setting := &storepb.InstanceStorageSetting{
		DefaultStorageId: recent.Id,
		Storages:         []*storepb.Storage{old, recent, local},
	}

	store.NormalizeInstanceStorageSetting(setting)
	require.Equal(t, []string{"recent", "old", "local"}, storageIDs(setting.Storages))

	setting.DefaultStorageId = local.Id
	store.NormalizeInstanceStorageSetting(setting)
	require.Equal(t, []string{"local", "recent", "old"}, storageIDs(setting.Storages))
	require.Equal(t, "recent-bucket", setting.S3Config.GetBucket())
}

func TestNormalizeInstanceStorageSettingSelfHealsS3WithoutConfig(t *testing.T) {
	setting := &storepb.InstanceStorageSetting{StorageType: storepb.InstanceStorageSetting_S3}

	store.NormalizeInstanceStorageSetting(setting)

	require.Equal(t, "local", setting.DefaultStorageId)
	require.Equal(t, storepb.StorageType_STORAGE_TYPE_LOCAL, store.GetDefaultStorage(setting).GetType())
	for _, configuredStorage := range setting.Storages {
		require.NotEmpty(t, configuredStorage.Id)
	}
}

func TestNormalizeInstanceStorageSettingUnspecifiedTypeDefaultsToLocal(t *testing.T) {
	// Matches the 0.31 migration and the pre-registry runtime default: a setting
	// that never chose a type stays LOCAL even when an S3 config is present.
	setting := &storepb.InstanceStorageSetting{
		S3Config: &storepb.StorageS3Config{
			AccessKeyId:     "access-key",
			AccessKeySecret: "secret",
			Endpoint:        "https://s3.example.com",
			Region:          "us-east-1",
			Bucket:          "memos",
		},
	}

	store.NormalizeInstanceStorageSetting(setting)

	require.Equal(t, storepb.StorageType_STORAGE_TYPE_LOCAL, store.GetDefaultStorage(setting).GetType())
	var s3Count int
	for _, configuredStorage := range setting.Storages {
		if configuredStorage.GetType() == storepb.StorageType_STORAGE_TYPE_S3 {
			s3Count++
		}
	}
	require.Equal(t, 1, s3Count, "the legacy S3 config must stay registered as a selectable storage")
}

func TestResolveStorageFallsBackWhenStorageIDMissing(t *testing.T) {
	setting := legacyS3StorageSetting("https://s3.example.com", "memos", "secret")
	store.NormalizeInstanceStorageSetting(setting)

	// The registry may be rebuilt without preserving IDs (deployment file,
	// restored backup); a dangling reference must fall back to the namespace
	// chain instead of permanently orphaning the attachment.
	resolved, err := store.ResolveStorage(setting, "s3-dangling", nil)
	require.NoError(t, err)
	require.Equal(t, setting.DefaultStorageId, resolved.Id)

	embedded := &storepb.StorageS3Config{
		AccessKeyId:     "old-access-key",
		AccessKeySecret: "old-secret",
		Endpoint:        "https://s3.example.com/",
		Region:          "us-east-1",
		Bucket:          "memos",
	}
	resolved, err = store.ResolveStorage(setting, "s3-dangling", embedded)
	require.NoError(t, err)
	require.Equal(t, setting.DefaultStorageId, resolved.Id)

	_, err = store.ResolveStorage(&storepb.InstanceStorageSetting{}, "s3-dangling", nil)
	require.ErrorContains(t, err, `storage "s3-dangling" is not configured`)
}

func TestResolveStorageDriverByStorageID(t *testing.T) {
	setting := &storepb.InstanceStorageSetting{
		DefaultStorageId: "primary",
		Storages: []*storepb.Storage{
			{
				Id:   "primary",
				Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
					AccessKeyId:     "access-key",
					AccessKeySecret: "secret",
					Endpoint:        "https://s3.example.com",
					Region:          "us-east-1",
					Bucket:          "memos",
				}},
			},
		},
	}

	driver, err := store.ResolveStorageDriver(context.Background(), setting, "primary", nil)
	require.NoError(t, err)
	require.IsType(t, &s3.Driver{}, driver)

	_, err = store.ResolveStorageDriver(context.Background(), setting, "missing", nil)
	require.ErrorContains(t, err, `storage "missing" is not configured`)
}

func TestResolveStorageDriverSupportsLegacyEmbeddedConfig(t *testing.T) {
	legacyConfig := &storepb.StorageS3Config{
		AccessKeyId:     "access-key",
		AccessKeySecret: "secret",
		Endpoint:        "https://legacy-s3.example.com",
		Region:          "us-east-1",
		Bucket:          "legacy",
	}

	driver, err := store.ResolveStorageDriver(context.Background(), nil, "", legacyConfig)
	require.NoError(t, err)
	require.IsType(t, &s3.Driver{}, driver)
}

func TestResolveStorageDriverUsesCurrentCredentialsForLegacyAttachment(t *testing.T) {
	legacyConfig := &storepb.StorageS3Config{
		AccessKeyId:     "old-access-key",
		AccessKeySecret: "old-secret",
		Endpoint:        "https://s3.example.com/",
		Region:          "us-east-1",
		Bucket:          "memos",
	}
	setting := &storepb.InstanceStorageSetting{
		DefaultStorageId: "primary",
		Storages: []*storepb.Storage{
			{
				Id:   "primary",
				Type: storepb.StorageType_STORAGE_TYPE_S3,
				Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
					AccessKeyId:     "new-access-key",
					AccessKeySecret: "new-secret",
					Endpoint:        "https://s3.example.com",
					Region:          "us-east-1",
					Bucket:          "memos",
					UsePathStyle:    true,
				}},
			},
		},
	}

	driver, err := store.ResolveStorageDriver(context.Background(), setting, "", legacyConfig)
	require.NoError(t, err)
	s3Driver, ok := driver.(*s3.Driver)
	require.True(t, ok)
	require.True(t, s3Driver.Client.Options().UsePathStyle)
}

func legacyS3StorageSetting(endpoint, bucket, secret string) *storepb.InstanceStorageSetting {
	return &storepb.InstanceStorageSetting{
		StorageType: storepb.InstanceStorageSetting_S3,
		S3Config: &storepb.StorageS3Config{
			AccessKeyId:     "access-key",
			AccessKeySecret: secret,
			Endpoint:        endpoint,
			Region:          "us-east-1",
			Bucket:          bucket,
		},
	}
}

func s3Storage(id, bucket string) *storepb.Storage {
	return &storepb.Storage{
		Id:   id,
		Type: storepb.StorageType_STORAGE_TYPE_S3,
		Config: &storepb.Storage_S3Config{S3Config: &storepb.StorageS3Config{
			Endpoint: "https://s3.example.com",
			Region:   "us-east-1",
			Bucket:   bucket,
		}},
	}
}

func storageIDs(storages []*storepb.Storage) []string {
	ids := make([]string, 0, len(storages))
	for _, configuredStorage := range storages {
		ids = append(ids, configuredStorage.Id)
	}
	return ids
}

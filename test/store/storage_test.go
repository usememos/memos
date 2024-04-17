package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestStorageStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	storage, err := ts.CreateStorage(ctx, &storepb.Storage{
		Name: "test_storage",
		Type: storepb.Storage_S3,
		Config: &storepb.StorageConfig{
			StorageConfig: &storepb.StorageConfig_S3Config{
				S3Config: &storepb.S3Config{
					EndPoint: "http://localhost:9000",
				},
			},
		},
	})
	require.NoError(t, err)
	newStorageName := "new_storage_name"
	updatedStorage, err := ts.UpdateStorage(ctx, &store.UpdateStorageV1{
		ID:   storage.Id,
		Type: storage.Type,
		Name: &newStorageName,
	})
	require.NoError(t, err)
	require.Equal(t, newStorageName, updatedStorage.Name)
	storageList, err := ts.ListStorages(ctx, &store.FindStorage{})
	require.NoError(t, err)
	require.Equal(t, 1, len(storageList))
	require.Equal(t, updatedStorage, storageList[0])
	err = ts.DeleteStorage(ctx, &store.DeleteStorage{
		ID: storage.Id,
	})
	require.NoError(t, err)
	storageList, err = ts.ListStorages(ctx, &store.FindStorage{})
	require.NoError(t, err)
	require.Equal(t, 0, len(storageList))
	ts.Close()
}

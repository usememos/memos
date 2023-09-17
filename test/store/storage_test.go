package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestStorageStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	storage, err := ts.CreateStorage(ctx, &store.Storage{
		Name:   "test_storage",
		Type:   "S3",
		Config: "{}",
	})
	require.NoError(t, err)
	newStorageName := "new_storage_name"
	updatedStorage, err := ts.UpdateStorage(ctx, &store.UpdateStorage{
		ID:   storage.ID,
		Name: &newStorageName,
	})
	require.NoError(t, err)
	require.Equal(t, newStorageName, updatedStorage.Name)
	storageList, err := ts.ListStorages(ctx, &store.FindStorage{})
	require.NoError(t, err)
	require.Equal(t, 1, len(storageList))
	require.Equal(t, updatedStorage, storageList[0])
	err = ts.DeleteStorage(ctx, &store.DeleteStorage{
		ID: storage.ID,
	})
	require.NoError(t, err)
	storageList, err = ts.ListStorages(ctx, &store.FindStorage{})
	require.NoError(t, err)
	require.Equal(t, 0, len(storageList))
}

package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
)

func TestResourceStore(t *testing.T) {
	ctx := context.Background()
	store := NewTestingStore(ctx, t)
	_, err := store.CreateResource(ctx, &api.ResourceCreate{
		CreatorID:    101,
		Filename:     "test.epub",
		Blob:         []byte("test"),
		InternalPath: "",
		ExternalLink: "",
		Type:         "application/epub+zip",
		Size:         637607,
		PublicID:     "a02748e2-9b56-46b2-8b1f-72d686d52f77",
	})
	require.NoError(t, err)

	correctFilename := "test.epub"
	incorrectFilename := "test.png"
	res, err := store.FindResource(ctx, &api.ResourceFind{
		Filename: &correctFilename,
	})
	require.NoError(t, err)
	require.Equal(t, correctFilename, res.Filename)
	require.Equal(t, 1, res.ID)
	_, err = store.FindResource(ctx, &api.ResourceFind{
		Filename: &incorrectFilename,
	})
	require.Error(t, err)

	correctCreatorID := 101
	incorrectCreatorID := 102
	_, err = store.FindResource(ctx, &api.ResourceFind{
		CreatorID: &correctCreatorID,
	})
	require.NoError(t, err)
	_, err = store.FindResource(ctx, &api.ResourceFind{
		CreatorID: &incorrectCreatorID,
	})
	require.Error(t, err)

	err = store.DeleteResource(ctx, &api.ResourceDelete{
		ID: 1,
	})
	require.NoError(t, err)
	err = store.DeleteResource(ctx, &api.ResourceDelete{
		ID: 2,
	})
	require.Error(t, err)
}

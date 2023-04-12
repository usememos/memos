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
		CreatorID:    1,
		Filename:     "test.png",
		Blob:         []byte("test"),
		InternalPath: "test",
		ExternalLink: "test",
		Type:         "test",
		Size:         1,
		PublicID:     "test",
	})
	require.NoError(t, err)
}

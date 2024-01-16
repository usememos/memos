package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestTagStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	tag, err := ts.UpsertTag(ctx, &store.Tag{
		CreatorID: user.ID,
		Name:      "test_tag",
	})
	require.NoError(t, err)
	require.Equal(t, "test_tag", tag.Name)
	require.Equal(t, user.ID, tag.CreatorID)
	tags, err := ts.ListTags(ctx, &store.FindTag{
		CreatorID: user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(tags))
	require.Equal(t, tag, tags[0])
	err = ts.DeleteTag(ctx, &store.DeleteTag{
		Name:      "test_tag",
		CreatorID: user.ID,
	})
	require.NoError(t, err)
	tags, err = ts.ListTags(ctx, &store.FindTag{})
	require.NoError(t, err)
	require.Equal(t, 0, len(tags))
	ts.Close()
}

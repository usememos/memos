package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/api"
)

func TestMemoStore(t *testing.T) {
	ctx := context.Background()
	store := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, store)
	require.NoError(t, err)
	memoCreate := &api.MemoCreate{
		CreatorID:  user.ID,
		Content:    "test_content",
		Visibility: api.Public,
	}
	memo, err := store.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	memoPatchContent := "test_content_2"
	memoPatch := &api.MemoPatch{
		ID:      memo.ID,
		Content: &memoPatchContent,
	}
	memo, err = store.PatchMemo(ctx, memoPatch)
	require.NoError(t, err)
	require.Equal(t, memoPatchContent, memo.Content)
	memoList, err := store.FindMemoList(ctx, &api.MemoFind{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(memoList))
	require.Equal(t, memo, memoList[1])
	err = store.DeleteMemo(ctx, &api.MemoDelete{
		ID: memo.ID,
	})
	require.NoError(t, err)
}

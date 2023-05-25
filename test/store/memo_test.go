package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
)

func TestMemoStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memoCreate := &store.MemoMessage{
		CreatorID:  user.ID,
		Content:    "test_content",
		Visibility: store.Public,
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	memoPatchContent := "test_content_2"
	memoPatch := &store.UpdateMemoMessage{
		ID:      memo.ID,
		Content: &memoPatchContent,
	}
	err = ts.UpdateMemo(ctx, memoPatch)
	require.NoError(t, err)
	memo, err = ts.GetMemo(ctx, &store.FindMemoMessage{
		ID: &memo.ID,
	})
	require.NoError(t, err)
	memoList, err := ts.ListMemos(ctx, &store.FindMemoMessage{
		CreatorID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(memoList))
	require.Equal(t, memo, memoList[1])
	err = ts.DeleteMemo(ctx, &store.DeleteMemoMessage{
		ID: memo.ID,
	})
	require.NoError(t, err)
}

package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
)

func TestMemoRelationStore(t *testing.T) {
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
	memo2Create := &store.MemoMessage{
		CreatorID:  user.ID,
		Content:    "test_content_2",
		Visibility: store.Public,
	}
	memo2, err := ts.CreateMemo(ctx, memo2Create)
	require.NoError(t, err)
	require.Equal(t, memo2Create.Content, memo2.Content)
	memoRelationMessage := &store.MemoRelationMessage{
		MemoID:        memo.ID,
		RelatedMemoID: memo2.ID,
		Type:          store.MemoRelationReference,
	}
	_, err = ts.UpsertMemoRelation(ctx, memoRelationMessage)
	require.NoError(t, err)
	memoRelation, err := ts.ListMemoRelations(ctx, &store.FindMemoRelationMessage{
		MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(memoRelation))
	require.Equal(t, memo2.ID, memoRelation[0].RelatedMemoID)
	require.Equal(t, memo.ID, memoRelation[0].MemoID)
	require.Equal(t, store.MemoRelationReference, memoRelation[0].Type)
	err = ts.DeleteMemo(ctx, &store.DeleteMemoMessage{
		ID: memo2.ID,
	})
	require.NoError(t, err)
	memoRelation, err = ts.ListMemoRelations(ctx, &store.FindMemoRelationMessage{
		MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoRelation))
}

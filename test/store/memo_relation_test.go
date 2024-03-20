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
	memoCreate := &store.Memo{
		UID:        "main-memo",
		CreatorID:  user.ID,
		Content:    "main memo content",
		Visibility: store.Public,
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	relatedMemoCreate := &store.Memo{
		UID:        "related-memo",
		CreatorID:  user.ID,
		Content:    "related memo content",
		Visibility: store.Public,
	}
	relatedMemo, err := ts.CreateMemo(ctx, relatedMemoCreate)
	require.NoError(t, err)
	require.Equal(t, relatedMemoCreate.Content, relatedMemo.Content)
	commentMemoCreate := &store.Memo{
		UID:        "comment-memo",
		CreatorID:  user.ID,
		Content:    "comment memo content",
		Visibility: store.Public,
	}
	commentMemo, err := ts.CreateMemo(ctx, commentMemoCreate)
	require.NoError(t, err)
	require.Equal(t, commentMemoCreate.Content, commentMemo.Content)

	// Reference relation.
	referenceRelation := &store.MemoRelation{
		MemoID:        memo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	}
	_, err = ts.UpsertMemoRelation(ctx, referenceRelation)
	require.NoError(t, err)
	// Comment relation.
	commentRelation := &store.MemoRelation{
		MemoID:        memo.ID,
		RelatedMemoID: commentMemo.ID,
		Type:          store.MemoRelationComment,
	}
	_, err = ts.UpsertMemoRelation(ctx, commentRelation)
	require.NoError(t, err)
	ts.Close()
}

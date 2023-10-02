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
		CreatorID:  user.ID,
		Content:    "main memo content",
		Visibility: store.Public,
	}
	memo, err := ts.CreateMemo(ctx, memoCreate)
	require.NoError(t, err)
	require.Equal(t, memoCreate.Content, memo.Content)
	relatedMemoCreate := &store.Memo{
		CreatorID:  user.ID,
		Content:    "related memo content",
		Visibility: store.Public,
	}
	relatedMemo, err := ts.CreateMemo(ctx, relatedMemoCreate)
	require.NoError(t, err)
	require.Equal(t, relatedMemoCreate.Content, relatedMemo.Content)
	commentMemoCreate := &store.Memo{
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

	memo, err = ts.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(memo.RelationList))
	require.Equal(t, referenceRelation, memo.RelationList[0])
	require.Equal(t, commentRelation, memo.RelationList[1])
	relatedMemo, err = ts.GetMemo(ctx, &store.FindMemo{
		ID: &relatedMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(relatedMemo.RelationList))
	require.Equal(t, referenceRelation, relatedMemo.RelationList[0])
	commentMemo, err = ts.GetMemo(ctx, &store.FindMemo{
		ID: &commentMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(commentMemo.RelationList))
	require.Equal(t, commentRelation, commentMemo.RelationList[0])
	err = ts.DeleteMemo(ctx, &store.DeleteMemo{
		ID: relatedMemo.ID,
	})
	require.NoError(t, err)
	err = ts.DeleteMemo(ctx, &store.DeleteMemo{
		ID: commentMemo.ID,
	})
	require.NoError(t, err)
	memoRelation, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoRelation))
}

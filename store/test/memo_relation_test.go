package test

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

func TestMemoRelationListByMemoID(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create main memo
	mainMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "main-memo",
		CreatorID:  user.ID,
		Content:    "main memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create related memos
	relatedMemo1, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "related-memo-1",
		CreatorID:  user.ID,
		Content:    "related memo 1 content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	relatedMemo2, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "related-memo-2",
		CreatorID:  user.ID,
		Content:    "related memo 2 content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create relations
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo1.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo2.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// List by memo ID
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(relations))

	// List by type
	refType := store.MemoRelationReference
	refRelations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
		Type:   &refType,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(refRelations))
	require.Equal(t, store.MemoRelationReference, refRelations[0].Type)

	// List by related memo ID
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &relatedMemo1.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(relations))

	ts.Close()
}

func TestMemoRelationDelete(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create memos
	mainMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "main-memo",
		CreatorID:  user.ID,
		Content:    "main memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	relatedMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "related-memo",
		CreatorID:  user.ID,
		Content:    "related memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create relation
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Verify relation exists
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(relations))

	// Delete relation by memo ID
	relType := store.MemoRelationReference
	err = ts.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID:        &mainMemo.ID,
		RelatedMemoID: &relatedMemo.ID,
		Type:          &relType,
	})
	require.NoError(t, err)

	// Verify relation is deleted
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(relations))

	ts.Close()
}

func TestMemoRelationDifferentTypes(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	mainMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "main-memo",
		CreatorID:  user.ID,
		Content:    "main memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	relatedMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "related-memo",
		CreatorID:  user.ID,
		Content:    "related memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create reference relation
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Create comment relation (same memos, different type - should be allowed)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// Verify both relations exist
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(relations))

	ts.Close()
}

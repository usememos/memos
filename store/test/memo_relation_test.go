package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoRelationStore(t *testing.T) {
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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

func TestMemoRelationUpsertSameRelation(t *testing.T) {
	t.Parallel()
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

	// Create relation
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Upsert the same relation again (should not create duplicate)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Verify only one relation exists
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)

	ts.Close()
}

func TestMemoRelationDeleteByType(t *testing.T) {
	t.Parallel()
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

	// Create reference relations
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo1.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Create comment relation
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        mainMemo.ID,
		RelatedMemoID: relatedMemo2.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// Delete only reference type relations
	refType := store.MemoRelationReference
	err = ts.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &mainMemo.ID,
		Type:   &refType,
	})
	require.NoError(t, err)

	// Verify only comment relation remains
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, store.MemoRelationComment, relations[0].Type)

	ts.Close()
}

func TestMemoRelationDeleteByMemoID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo1, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-1",
		CreatorID:  user.ID,
		Content:    "memo 1 content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memo2, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-2",
		CreatorID:  user.ID,
		Content:    "memo 2 content",
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

	// Create relations for both memos
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo1.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo2.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Delete all relations for memo1
	err = ts.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &memo1.ID,
	})
	require.NoError(t, err)

	// Verify memo1's relations are gone
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo1.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 0)

	// Verify memo2's relations still exist
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo2.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)

	ts.Close()
}

func TestMemoRelationListByRelatedMemoID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a memo that will be referenced by others
	targetMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "target-memo",
		CreatorID:  user.ID,
		Content:    "target memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create memos that reference the target
	referrer1, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "referrer-1",
		CreatorID:  user.ID,
		Content:    "referrer 1 content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	referrer2, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "referrer-2",
		CreatorID:  user.ID,
		Content:    "referrer 2 content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create relations pointing to target
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        referrer1.ID,
		RelatedMemoID: targetMemo.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        referrer2.ID,
		RelatedMemoID: targetMemo.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// List by related memo ID (find all memos that reference the target)
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &targetMemo.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 2)

	ts.Close()
}

func TestMemoRelationListCombinedFilters(t *testing.T) {
	t.Parallel()
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

	// Create multiple relations
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

	// List with MemoID and Type filter
	refType := store.MemoRelationReference
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
		Type:   &refType,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, relatedMemo1.ID, relations[0].RelatedMemoID)

	// List with MemoID, RelatedMemoID, and Type filter
	commentType := store.MemoRelationComment
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID:        &mainMemo.ID,
		RelatedMemoID: &relatedMemo2.ID,
		Type:          &commentType,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)

	ts.Close()
}

func TestMemoRelationListEmpty(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-no-relations",
		CreatorID:  user.ID,
		Content:    "memo with no relations",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// List relations for memo with none
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memo.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 0)

	ts.Close()
}

func TestMemoRelationBidirectional(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memoA, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-a",
		CreatorID:  user.ID,
		Content:    "memo A content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoB, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-b",
		CreatorID:  user.ID,
		Content:    "memo B content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create relation A -> B
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoB.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Create relation B -> A (reverse direction)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoB.ID,
		RelatedMemoID: memoA.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Verify A -> B exists
	relationsFromA, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memoA.ID,
	})
	require.NoError(t, err)
	require.Len(t, relationsFromA, 1)
	require.Equal(t, memoB.ID, relationsFromA[0].RelatedMemoID)

	// Verify B -> A exists
	relationsFromB, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &memoB.ID,
	})
	require.NoError(t, err)
	require.Len(t, relationsFromB, 1)
	require.Equal(t, memoA.ID, relationsFromB[0].RelatedMemoID)

	ts.Close()
}

func TestMemoRelationListByMemoIDList(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create 3 memos.
	memoA, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-a",
		CreatorID:  user.ID,
		Content:    "memo A content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoB, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-b",
		CreatorID:  user.ID,
		Content:    "memo B content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoC, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-c",
		CreatorID:  user.ID,
		Content:    "memo C content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoD, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-d",
		CreatorID:  user.ID,
		Content:    "memo D content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// A -> B (reference)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoB.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// A -> C (comment)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoC.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// D -> B (reference) — B appears as related_memo_id
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoD.ID,
		RelatedMemoID: memoB.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Batch query for memos A and B: should return all 3 relations
	// (A->B because A is in list, A->C because A is in list, D->B because B is in list)
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoA.ID, memoB.ID},
	})
	require.NoError(t, err)
	require.Len(t, relations, 3)

	// Batch query for memo C only: should return 1 relation (A->C because C is related_memo_id)
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoC.ID},
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, memoA.ID, relations[0].MemoID)
	require.Equal(t, memoC.ID, relations[0].RelatedMemoID)

	// Batch query for memo D only: should return 1 relation (D->B because D is memo_id)
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoD.ID},
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, memoD.ID, relations[0].MemoID)
	require.Equal(t, memoB.ID, relations[0].RelatedMemoID)

	ts.Close()
}

func TestMemoRelationListByMemoIDListEmpty(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-no-relations",
		CreatorID:  user.ID,
		Content:    "memo with no relations",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Batch query with a memo that has no relations.
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memo.ID},
	})
	require.NoError(t, err)
	require.Len(t, relations, 0)

	// Empty MemoIDList should not filter by MemoIDList (returns based on other filters).
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{},
	})
	require.NoError(t, err)
	require.Len(t, relations, 0)

	ts.Close()
}

func TestMemoRelationListByMemoIDListWithTypeFilter(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memoA, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-a",
		CreatorID:  user.ID,
		Content:    "memo A content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoB, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-b",
		CreatorID:  user.ID,
		Content:    "memo B content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoC, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-c",
		CreatorID:  user.ID,
		Content:    "memo C content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// A -> B (reference)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoB.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// A -> C (comment)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoC.ID,
		Type:          store.MemoRelationComment,
	})
	require.NoError(t, err)

	// Batch query with type filter: only references
	refType := store.MemoRelationReference
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoA.ID},
		Type:       &refType,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, store.MemoRelationReference, relations[0].Type)

	// Batch query with type filter: only comments
	commentType := store.MemoRelationComment
	relations, err = ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoA.ID},
		Type:       &commentType,
	})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, store.MemoRelationComment, relations[0].Type)

	ts.Close()
}

func TestMemoRelationListByMemoIDListBothDirections(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memoA, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-a",
		CreatorID:  user.ID,
		Content:    "memo A content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoB, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-b",
		CreatorID:  user.ID,
		Content:    "memo B content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	memoX, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "memo-x",
		CreatorID:  user.ID,
		Content:    "memo X content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// X -> A (A appears as related_memo_id)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoX.ID,
		RelatedMemoID: memoA.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// A -> B (A appears as memo_id)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memoA.ID,
		RelatedMemoID: memoB.ID,
		Type:          store.MemoRelationReference,
	})
	require.NoError(t, err)

	// Query with MemoIDList=[A]: should find both relations (A as source and A as target).
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoIDList: []int32{memoA.ID},
	})
	require.NoError(t, err)
	require.Len(t, relations, 2)

	// Verify we got both directions.
	memoIDs := map[int32]bool{}
	relatedIDs := map[int32]bool{}
	for _, r := range relations {
		memoIDs[r.MemoID] = true
		relatedIDs[r.RelatedMemoID] = true
	}
	require.True(t, memoIDs[memoX.ID], "should include X->A relation")
	require.True(t, memoIDs[memoA.ID], "should include A->B relation")
	require.True(t, relatedIDs[memoA.ID], "should include X->A relation")
	require.True(t, relatedIDs[memoB.ID], "should include A->B relation")

	ts.Close()
}

func TestMemoRelationMultipleRelationsToSameMemo(t *testing.T) {
	t.Parallel()
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

	// Create multiple memos that all relate to the main memo
	for i := 1; i <= 5; i++ {
		relatedMemo, err := ts.CreateMemo(ctx, &store.Memo{
			UID:        "related-memo-" + string(rune('0'+i)),
			CreatorID:  user.ID,
			Content:    "related memo content",
			Visibility: store.Public,
		})
		require.NoError(t, err)

		_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        mainMemo.ID,
			RelatedMemoID: relatedMemo.ID,
			Type:          store.MemoRelationReference,
		})
		require.NoError(t, err)
	}

	// Verify all 5 relations exist
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &mainMemo.ID,
	})
	require.NoError(t, err)
	require.Len(t, relations, 5)

	ts.Close()
}

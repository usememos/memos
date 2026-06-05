package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// TestMemoDraftCreateAndReadBack proves C4/E10: a memo created with
// RowStatus=DRAFT must round-trip as DRAFT. Fails on the pre-T6 tree because
// the driver CreateMemo INSERT omits row_status and relies on DEFAULT 'NORMAL'.
func TestMemoDraftCreateAndReadBack(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	created, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "draft-roundtrip",
		CreatorID:  user.ID,
		Content:    "unpublished thoughts",
		Visibility: store.Private,
		RowStatus:  store.Draft,
	})
	require.NoError(t, err)
	require.Equal(t, store.Draft, created.RowStatus)

	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &created.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, store.Draft, found.RowStatus)

	ts.Close()
}

// TestMemoDraftExcludedFromNormalList: a NORMAL-filtered list never returns a
// draft (the property every default reader relies on).
func TestMemoDraftExcludedFromNormalList(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	normal, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "normal-one",
		CreatorID:  user.ID,
		Content:    "published",
		Visibility: store.Public,
		RowStatus:  store.Normal,
	})
	require.NoError(t, err)

	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "draft-one",
		CreatorID:  user.ID,
		Content:    "draft",
		Visibility: store.Public,
		RowStatus:  store.Draft,
	})
	require.NoError(t, err)

	normalStatus := store.Normal
	list, err := ts.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
		RowStatus: &normalStatus,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	require.Equal(t, normal.ID, list[0].ID)
	require.Equal(t, store.Normal, list[0].RowStatus)

	ts.Close()
}

// TestMemoDraftListedWhenRequested: an explicit DRAFT+creator filter returns
// only the caller's drafts.
func TestMemoDraftListedWhenRequested(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID:        "normal-two",
		CreatorID:  user.ID,
		Content:    "published",
		Visibility: store.Public,
		RowStatus:  store.Normal,
	})
	require.NoError(t, err)

	draft, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "draft-two",
		CreatorID:  user.ID,
		Content:    "draft",
		Visibility: store.Private,
		RowStatus:  store.Draft,
	})
	require.NoError(t, err)

	draftStatus := store.Draft
	list, err := ts.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
		RowStatus: &draftStatus,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	require.Equal(t, draft.ID, list[0].ID)
	require.Equal(t, store.Draft, list[0].RowStatus)

	ts.Close()
}

// TestMemoPublishRefreshesCreatedTs pins E5-forward / O4 at the store layer:
// publishing a draft (DRAFT->NORMAL with refreshed timestamps) persists the new
// row_status and the refreshed created_ts/updated_ts. Fails pre-T6 because the
// draft cannot even be created as DRAFT (C4).
func TestMemoPublishRefreshesCreatedTs(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	oldTs := int64(1600000000) // 2020-09-13
	draft, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "draft-publish",
		CreatorID:  user.ID,
		Content:    "soon to publish",
		Visibility: store.Public,
		RowStatus:  store.Draft,
		CreatedTs:  oldTs,
		UpdatedTs:  oldTs,
	})
	require.NoError(t, err)
	require.Equal(t, store.Draft, draft.RowStatus)
	require.Equal(t, oldTs, draft.CreatedTs)

	newTs := time.Now().Unix()
	normalStatus := store.Normal
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:        draft.ID,
		RowStatus: &normalStatus,
		CreatedTs: &newTs,
		UpdatedTs: &newTs,
	}))

	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &draft.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, store.Normal, found.RowStatus)
	require.Equal(t, newTs, found.CreatedTs)
	require.Equal(t, newTs, found.UpdatedTs)
	require.Greater(t, found.CreatedTs, oldTs)

	ts.Close()
}

// TestMemoNormalEditDoesNotTouchCreatedTs pins E5-reverse: a plain content edit
// of an already-NORMAL memo must never move created_ts. Green today; a
// regression here would mean publish logic leaked into the normal edit path.
func TestMemoNormalEditDoesNotTouchCreatedTs(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	oldTs := int64(1600000000)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "normal-edit",
		CreatorID:  user.ID,
		Content:    "original",
		Visibility: store.Public,
		RowStatus:  store.Normal,
		CreatedTs:  oldTs,
		UpdatedTs:  oldTs,
	})
	require.NoError(t, err)
	require.Equal(t, store.Normal, memo.RowStatus)
	require.Equal(t, oldTs, memo.CreatedTs)

	newContent := "edited content"
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:      memo.ID,
		Content: &newContent,
	}))

	found, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, newContent, found.Content)
	require.Equal(t, oldTs, found.CreatedTs)

	ts.Close()
}

package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoShareDeleteRequiresSelector(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "memo-share-delete-selector", CreatorID: owner.ID, Content: "memo", Visibility: store.Public,
	})
	require.NoError(t, err)

	for _, uid := range []string{"memo-share-delete-first", "memo-share-delete-second"} {
		_, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: uid, MemoID: memo.ID, CreatorID: owner.ID})
		require.NoError(t, err)
	}

	require.Error(t, ts.DeleteMemoShare(ctx, &store.DeleteMemoShare{}))
	require.Error(t, ts.DeleteMemoShare(ctx, &store.DeleteMemoShare{MemoID: &memo.ID}))
	shares, err := ts.ListMemoShares(ctx, &store.FindMemoShare{MemoID: &memo.ID})
	require.NoError(t, err)
	require.Len(t, shares, 2)

	require.NoError(t, ts.DeleteMemoShare(ctx, &store.DeleteMemoShare{UID: &shares[0].UID}))
	shares, err = ts.ListMemoShares(ctx, &store.FindMemoShare{MemoID: &memo.ID})
	require.NoError(t, err)
	require.Len(t, shares, 1)
}

package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoOrganizerStore(t *testing.T) {
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

	memoOrganizer, err := ts.UpsertMemoOrganizer(ctx, &store.MemoOrganizer{
		MemoID: memo.ID,
		UserID: user.ID,
		Pinned: true,
	})
	require.NoError(t, err)
	require.NotNil(t, memoOrganizer)
	require.Equal(t, memo.ID, memoOrganizer.MemoID)
	require.Equal(t, user.ID, memoOrganizer.UserID)
	require.Equal(t, true, memoOrganizer.Pinned)

	memoOrganizerTemp, err := ts.GetMemoOrganizer(ctx, &store.FindMemoOrganizer{
		MemoID: memo.ID,
	})
	require.NoError(t, err)
	require.Equal(t, memoOrganizer, memoOrganizerTemp)
	memoOrganizerTemp, err = ts.UpsertMemoOrganizer(ctx, &store.MemoOrganizer{
		MemoID: memo.ID,
		UserID: user.ID,
		Pinned: false,
	})
	require.NoError(t, err)
	require.NotNil(t, memoOrganizerTemp)
	require.Equal(t, memo.ID, memoOrganizerTemp.MemoID)
	require.Equal(t, user.ID, memoOrganizerTemp.UserID)
	require.Equal(t, false, memoOrganizerTemp.Pinned)
	err = ts.DeleteMemoOrganizer(ctx, &store.DeleteMemoOrganizer{
		MemoID: &memo.ID,
		UserID: &user.ID,
	})
	require.NoError(t, err)
	memoOrganizers, err := ts.ListMemoOrganizer(ctx, &store.FindMemoOrganizer{
		UserID: user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(memoOrganizers))
	ts.Close()
}

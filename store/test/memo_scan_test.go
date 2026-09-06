package test

import (
	"context"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/store"
)

func TestMemoIDScanBoundsAndExclusiveOrder(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { require.NoError(t, ts.Close()) })
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	var memos []*store.Memo
	for range 4 {
		memo, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "scan", Visibility: store.Private})
		require.NoError(t, err)
		memos = append(memos, memo)
	}
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memos[2].ID, Pinned: proto.Bool(true)}))
	find := &store.FindMemo{CreatorID: &user.ID, AfterID: &memos[0].ID, MaxID: &memos[2].ID, OrderByIDAsc: proto.Bool(true)}
	page, err := ts.ListMemos(ctx, find)
	require.NoError(t, err)
	require.Len(t, page, 2)
	require.Equal(t, memos[1].ID, page[0].ID)
	require.Equal(t, memos[2].ID, page[1].ID)
	find.OrderByIDAsc = proto.Bool(false)
	page, err = ts.ListMemos(ctx, find)
	require.NoError(t, err)
	require.Len(t, page, 2)
	require.Equal(t, memos[2].ID, page[0].ID)
	find.OrderByPinned = true
	_, err = ts.ListMemos(ctx, find)
	require.Error(t, err)
}

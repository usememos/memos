package test

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestUserMemoViewRemovalAndEmptyUpdates(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	peer, err := createTestingUserWithRole(ctx, ts, "view-peer", store.RoleUser)
	require.NoError(t, err)
	removed, err := ts.RemoveUserMemoView(ctx, owner.ID, "missing")
	require.NoError(t, err)
	require.False(t, removed)
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_MEMO_VIEWS})
	require.NoError(t, err)
	require.Nil(t, setting, "removing an absent view must not create a setting")
	for _, user := range []*store.User{owner, peer} {
		for _, id := range []string{"first", "middle", "last"} {
			require.NoError(t, ts.AddUserMemoView(ctx, user.ID, &storepb.MemoViewsUserSetting_MemoView{
				Id: id, Title: id, Filter: `tag in ["work"]`,
				Icon: &storepb.MemoViewsUserSetting_MemoView_Icon{Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Emoji{Emoji: "🌱"}},
			}))
		}
	}
	peerBefore, err := ts.GetUserMemoViews(ctx, peer.ID)
	require.NoError(t, err)
	updated, err := ts.UpdateUserMemoView(ctx, owner.ID, "missing", new("unused"), nil, nil)
	require.NoError(t, err)
	require.Nil(t, updated)
	var resetIcon *storepb.MemoViewsUserSetting_MemoView_Icon
	updated, err = ts.UpdateUserMemoView(ctx, owner.ID, "middle", new(""), new(""), &resetIcon)
	require.NoError(t, err)
	require.Equal(t, "", updated.Title)
	require.Equal(t, "", updated.Filter)
	require.Nil(t, updated.Icon)
	views, err := ts.GetUserMemoViews(ctx, owner.ID)
	require.NoError(t, err)
	require.Len(t, views, 3)
	require.True(t, proto.Equal(updated, views[1]))
	require.True(t, proto.Equal(peerBefore[0], views[0]))
	require.True(t, proto.Equal(peerBefore[2], views[2]))
	for _, id := range []string{"middle", "first", "last"} {
		removed, err := ts.RemoveUserMemoView(ctx, owner.ID, id)
		require.NoError(t, err)
		require.True(t, removed)
		removed, err = ts.RemoveUserMemoView(ctx, owner.ID, id)
		require.NoError(t, err)
		require.False(t, removed)
		views, err = ts.GetUserMemoViews(ctx, owner.ID)
		require.NoError(t, err)
		for _, view := range views {
			require.NotEqual(t, id, view.Id)
		}
	}
	require.Empty(t, views)
	persisted, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_MEMO_VIEWS})
	require.NoError(t, err)
	require.Len(t, persisted, 1)
	require.Empty(t, persisted[0].GetMemoViews().GetMemoViews())
	peerAfter, err := ts.GetUserMemoViews(ctx, peer.ID)
	require.NoError(t, err)
	require.Len(t, peerAfter, len(peerBefore))
	for i := range peerBefore {
		require.True(t, proto.Equal(peerBefore[i], peerAfter[i]))
	}
}

func TestUserMemoViewConcurrentAddUpdateRemove(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	for _, id := range []string{"remove", "update"} {
		require.NoError(t, ts.AddUserMemoView(ctx, owner.ID, &storepb.MemoViewsUserSetting_MemoView{Id: id, Title: id}))
	}
	start := make(chan struct{})
	var wg sync.WaitGroup
	var errs [3]error
	var removed bool
	wg.Go(func() {
		<-start
		removed, errs[0] = ts.RemoveUserMemoView(ctx, owner.ID, "remove")
	})
	wg.Go(func() {
		<-start
		_, errs[1] = ts.UpdateUserMemoView(ctx, owner.ID, "update", new("changed"), nil, nil)
	})
	wg.Go(func() {
		<-start
		errs[2] = ts.AddUserMemoView(ctx, owner.ID, &storepb.MemoViewsUserSetting_MemoView{Id: "added", Title: "new"})
	})
	close(start)
	wg.Wait()
	for _, err := range errs {
		require.NoError(t, err)
	}
	require.True(t, removed)
	// Read through the driver to prove all three writes were persisted.
	settings, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_MEMO_VIEWS})
	require.NoError(t, err)
	require.Len(t, settings, 1)
	want := &storepb.MemoViewsUserSetting{MemoViews: []*storepb.MemoViewsUserSetting_MemoView{
		{Id: "update", Title: "changed"}, {Id: "added", Title: "new"},
	}}
	require.True(t, proto.Equal(want, settings[0].GetMemoViews()))
}

func TestUserMemoViewFailedWritesPreserveCachedState(t *testing.T) {
	for _, operation := range []string{"add", "update", "remove"} {
		t.Run(operation, func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			owner, err := createTestingHostUser(ctx, ts)
			require.NoError(t, err)
			original := &storepb.MemoViewsUserSetting_MemoView{Id: "saved", Title: "original", Filter: `tag in ["work"]`}
			require.NoError(t, ts.AddUserMemoView(ctx, owner.ID, original))
			_, err = ts.GetUserMemoViews(ctx, owner.ID)
			require.NoError(t, err)
			canceled, cancel := context.WithCancel(ctx)
			cancel()
			switch operation {
			case "add":
				err = ts.AddUserMemoView(canceled, owner.ID, &storepb.MemoViewsUserSetting_MemoView{Id: "failed"})
			case "update":
				_, err = ts.UpdateUserMemoView(canceled, owner.ID, original.Id, new("failed"), nil, nil)
			case "remove":
				var removed bool
				removed, err = ts.RemoveUserMemoView(canceled, owner.ID, original.Id)
				require.False(t, removed)
			default:
				t.Fatalf("unexpected operation: %s", operation)
			}
			require.ErrorIs(t, err, context.Canceled)
			cached, err := ts.GetUserMemoViews(ctx, owner.ID)
			require.NoError(t, err)
			require.Len(t, cached, 1)
			require.True(t, proto.Equal(original, cached[0]))
			persisted, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_MEMO_VIEWS})
			require.NoError(t, err)
			require.Len(t, persisted, 1)
			require.Len(t, persisted[0].GetMemoViews().GetMemoViews(), 1)
			require.True(t, proto.Equal(original, persisted[0].GetMemoViews().GetMemoViews()[0]))
			removed, err := ts.RemoveUserMemoView(ctx, owner.ID, original.Id)
			require.NoError(t, err)
			require.True(t, removed, "failed write must release the settings lock")
		})
	}
}

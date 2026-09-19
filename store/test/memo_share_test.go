package test

import (
	"context"
	"testing"
	"time"

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

func TestMemoShareAuthorizedDeletion(t *testing.T) {
	for _, name := range []string{
		"owner by id", "owner by uid", "matching selectors", "instance admin", "archived memo",
		"unrelated actor", "archived actor", "missing actor", "demoted admin", "removed membership",
		"mismatched memo", "mismatched selectors", "missing share", "missing memo", "database failure",
	} {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			owner, err := createTestingUserWithRole(ctx, ts, "share-owner", store.RoleUser)
			require.NoError(t, err)
			admin, err := createTestingUserWithRole(ctx, ts, "share-admin", store.RoleAdmin)
			require.NoError(t, err)
			peer, err := createTestingUserWithRole(ctx, ts, "share-peer", store.RoleUser)
			require.NoError(t, err)
			space, err := ts.CreateSpace(ctx, &store.Space{UID: "share-space", Title: "Shares"}, owner.ID)
			require.NoError(t, err)
			_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: peer.ID, Role: store.SpaceMemberRoleAdmin}, owner.ID)
			require.NoError(t, err)
			memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "share-memo", CreatorID: owner.ID,
				Content: "memo", Visibility: store.Public, SpaceID: &space.ID})
			require.NoError(t, err)
			other, err := ts.CreateMemo(ctx, &store.Memo{UID: "other-share-memo", CreatorID: owner.ID,
				Content: "other", Visibility: store.Public})
			require.NoError(t, err)
			share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "share-token", MemoID: memo.ID,
				CreatorID: owner.ID, Policy: &store.MemoWritePolicy{ActorUserID: owner.ID, CreatingShare: true}})
			require.NoError(t, err)
			keep, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: "keep-token", MemoID: memo.ID, CreatorID: owner.ID})
			require.NoError(t, err)
			delete := &store.DeleteMemoShare{ID: &share.ID, MemoID: &memo.ID, Policy: &store.MemoWritePolicy{ActorUserID: owner.ID}}
			var wantErr error
			var removeTrigger func()
			switch name {
			case "owner by uid":
				delete.ID, delete.UID = nil, &share.UID
			case "matching selectors":
				delete.UID = &share.UID
			case "instance admin":
				delete.Policy.ActorUserID = admin.ID
			case "archived memo":
				require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, RowStatus: new(store.Archived)}))
			case "unrelated actor":
				delete.Policy.ActorUserID = peer.ID
				wantErr = store.ErrMemoPermissionDenied
			case "archived actor":
				_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: owner.ID, RowStatus: new(store.Archived)})
				require.NoError(t, err)
				wantErr = store.ErrMemoSpaceMembershipRequired
			case "missing actor":
				delete.Policy.ActorUserID = 99999
				wantErr = store.ErrMemoSpaceMembershipRequired
			case "demoted admin":
				delete.Policy.ActorUserID = admin.ID
				_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: admin.ID, Role: new(store.RoleUser)})
				require.NoError(t, err)
				wantErr = store.ErrMemoPermissionDenied
			case "removed membership":
				require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, peer.ID))
				wantErr = store.ErrMemoSpaceMembershipRequired
			case "mismatched memo":
				delete.MemoID = &other.ID
				wantErr = store.ErrMemoMutationConflict
			case "mismatched selectors":
				delete.UID = &keep.UID
				wantErr = store.ErrMemoMutationConflict
			case "missing share":
				delete.ID = new(int32(99999))
				wantErr = store.ErrMemoMutationConflict
			case "missing memo":
				delete.MemoID = new(int32(99999))
				wantErr = store.ErrMemoMutationConflict
			case "database failure":
				removeTrigger = rejectStoreDelete(t, ts, "memo_share")
			default:
			}
			before, err := ts.ListMemoShares(ctx, &store.FindMemoShare{})
			require.NoError(t, err)
			err = ts.DeleteMemoShare(ctx, delete)
			if wantErr != nil || removeTrigger != nil {
				if removeTrigger != nil {
					require.ErrorContains(t, err, "store test delete failure")
				} else {
					require.ErrorIs(t, err, wantErr)
				}
				after, err := ts.ListMemoShares(ctx, &store.FindMemoShare{})
				require.NoError(t, err)
				require.Equal(t, before, after)
				if removeTrigger != nil {
					removeTrigger()
					require.NoError(t, ts.DeleteMemoShare(ctx, delete), "failed transaction must release its locks")
				}
			} else {
				require.NoError(t, err)
				got, err := ts.GetMemoShare(ctx, &store.FindMemoShare{ID: &share.ID})
				require.NoError(t, err)
				require.Nil(t, got)
				require.ErrorIs(t, ts.DeleteMemoShare(ctx, delete), store.ErrMemoMutationConflict)
			}
			got, err := ts.GetMemoShare(ctx, &store.FindMemoShare{ID: &keep.ID})
			require.NoError(t, err)
			require.Equal(t, keep, got)
		})
	}
}

func TestMemoShareFiltersAndExpiryRoundTrip(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	peer, err := createTestingUserWithRole(ctx, ts, "share-peer", store.RoleUser)
	require.NoError(t, err)
	var shares []*store.MemoShare
	for i, user := range []*store.User{owner, peer} {
		memo, err := ts.CreateMemo(ctx, &store.Memo{UID: user.Username, CreatorID: user.ID, Content: "memo", Visibility: store.Private})
		require.NoError(t, err)
		var expiry *int64
		if i == 1 {
			expiry = new(time.Now().Add(-time.Hour).Unix())
		}
		share, err := ts.CreateMemoShare(ctx, &store.MemoShare{UID: user.Username, MemoID: memo.ID, CreatorID: user.ID, ExpiresTs: expiry})
		require.NoError(t, err)
		shares = append(shares, share)
	}
	for _, share := range shares {
		for _, find := range []*store.FindMemoShare{
			{ID: &share.ID}, {UID: &share.UID}, {MemoID: &share.MemoID}, {CreatorID: &share.CreatorID},
			{ID: &share.ID, UID: &share.UID, MemoID: &share.MemoID, CreatorID: &share.CreatorID},
		} {
			got, err := ts.GetMemoShare(ctx, find)
			require.NoError(t, err)
			require.Equal(t, share, got)
			list, err := ts.ListMemoShares(ctx, find)
			require.NoError(t, err)
			require.Equal(t, []*store.MemoShare{share}, list, "store listing includes expired grants for management")
		}
	}
	find := &store.FindMemoShare{ID: &shares[0].ID, CreatorID: &peer.ID}
	got, err := ts.GetMemoShare(ctx, find)
	require.NoError(t, err)
	require.Nil(t, got)
	list, err := ts.ListMemoShares(ctx, find)
	require.NoError(t, err)
	require.Empty(t, list)
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{UID: shares[0].UID, MemoID: shares[1].MemoID, CreatorID: peer.ID})
	require.Error(t, err, "duplicate bearer token must not replace its original grant")
	list, err = ts.ListMemoShares(ctx, &store.FindMemoShare{})
	require.NoError(t, err)
	require.Equal(t, shares, list)
}

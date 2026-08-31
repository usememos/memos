package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestMemoWritePolicyRevalidatesMembershipAndExactMemoShares(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-policy-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	admin, err := ts.CreateUser(ctx, &store.User{Username: "memo-policy-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-policy-space", Title: "Policy"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "memo-policy-root", CreatorID: owner.ID, Content: "memo", Visibility: store.Public, SpaceID: &space.ID})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{UID: "memo-policy-comment", CreatorID: owner.ID, Content: "comment"}, memo.ID, owner.ID)
	require.NoError(t, err)

	// A share on a related memo does not affect this memo's audience.
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{UID: "memo-policy-comment-share", MemoID: comment.ID, CreatorID: owner.ID})
	require.NoError(t, err)
	spaceAudience := store.SpaceAudience
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		Visibility: &spaceAudience,
		Policy:     memoWritePolicy(owner.ID, false),
	})
	require.NoError(t, err)

	public := store.Public
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &public})
	require.NoError(t, err)
	memo.Visibility = store.Public
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{UID: "memo-policy-direct-share", MemoID: memo.ID, CreatorID: owner.ID})
	require.NoError(t, err)
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		Visibility: &spaceAudience,
		Policy:     memoWritePolicy(owner.ID, false),
	})
	require.ErrorIs(t, err, store.ErrMemoShareConflict)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, admin.ID))
	updatedContent := "must not commit"
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:      memo.ID,
		Content: &updatedContent,
		Policy:  memoWritePolicy(owner.ID, false),
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)

	// The explicit lifecycle exception still permits withdrawal after removal.
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		ClearSpace: true,
		Policy:     memoWritePolicy(owner.ID, true),
	})
	require.NoError(t, err)
	memo, err = ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Nil(t, memo.SpaceID)
	require.Equal(t, "memo", memo.Content)
}

func TestMemoWritePolicyIgnoresExpiredSharesWhenNarrowingAudience(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-expired-share-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-expired-share-space", Title: "Expired share"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "memo-expired-share-root", CreatorID: owner.ID, Content: "memo", Visibility: store.Public, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	expiredTsSec := time.Now().Add(-time.Hour).Unix()
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{
		UID: "memo-expired-share-token", MemoID: memo.ID, CreatorID: owner.ID, ExpiresTs: &expiredTsSec,
	})
	require.NoError(t, err)

	spaceAudience := store.SpaceAudience
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{
		ID:         memo.ID,
		Visibility: &spaceAudience,
		Policy:     memoWritePolicy(owner.ID, false),
	})
	require.NoError(t, err)
}

func TestMemoWritePolicyRemovedMemberCanOnlyMoveOrWithdraw(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-move-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	admin, err := ts.CreateUser(ctx, &store.User{Username: "memo-move-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	source, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-move-source", Title: "Source"}, owner.ID)
	require.NoError(t, err)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: source.ID, UserID: admin.ID, Role: store.SpaceMemberRoleAdmin}, owner.ID)
	require.NoError(t, err)
	target, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-move-target", Title: "Target"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "memo-move", CreatorID: owner.ID, Content: "memo", Visibility: store.Public, SpaceID: &source.ID,
	})
	require.NoError(t, err)
	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: source.ID, UserID: owner.ID}, admin.ID))

	policy := memoWritePolicy(owner.ID, true)
	newContent := "must not commit"
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, SpaceID: &target.ID, Content: &newContent, Policy: policy})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)

	err = ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, SpaceID: &target.ID, Policy: policy})
	require.NoError(t, err)
	memo, err = ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, &target.ID, memo.SpaceID)
	require.Equal(t, "memo", memo.Content)
}

func TestMemoWritePolicyUsesCurrentAudienceForMoveRules(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-current-audience-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	source, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-current-audience-source", Title: "Source"}, owner.ID)
	require.NoError(t, err)
	target, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-current-audience-target", Title: "Target"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "memo-current-audience", CreatorID: owner.ID, Content: "memo", Visibility: store.Public, SpaceID: &source.ID,
	})
	require.NoError(t, err)

	// Simulate the audience changing after the transport read but before its
	// policy-backed move. The transaction must use SPACE as the current
	// audience and require explicit confirmation.
	spaceAudience := store.SpaceAudience
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &spaceAudience}))
	policy := memoWritePolicy(owner.ID, true)
	err = ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, SpaceID: &target.ID, Policy: policy})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)

	err = ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, SpaceID: &target.ID, Visibility: &spaceAudience, Policy: policy})
	require.NoError(t, err)
	stored, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, &target.ID, stored.SpaceID)
	require.Equal(t, store.SpaceAudience, stored.Visibility)
}

func TestMemoWritePolicyUsesCurrentAudienceWhenCreatingShare(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-current-share-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-current-share-space", Title: "Share"}, owner.ID)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "memo-current-share", CreatorID: owner.ID, Content: "memo", Visibility: store.Public, SpaceID: &space.ID,
	})
	require.NoError(t, err)

	policy := &store.MemoWritePolicy{ActorUserID: owner.ID, CreatingShare: true}
	spaceAudience := store.SpaceAudience
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &spaceAudience}))
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{
		UID: "memo-current-share-token", MemoID: memo.ID, CreatorID: owner.ID, Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoShareConflict)

	public := store.Public
	archived := store.Archived
	require.NoError(t, ts.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &public, RowStatus: &archived}))
	_, err = ts.CreateMemoShare(ctx, &store.MemoShare{
		UID: "memo-current-archived-share", MemoID: memo.ID, CreatorID: owner.ID, Policy: policy,
	})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)
}

func memoWritePolicy(actorUserID int32, lifecycleOnly bool) *store.MemoWritePolicy {
	return &store.MemoWritePolicy{ActorUserID: actorUserID, LifecycleOnly: lifecycleOnly}
}

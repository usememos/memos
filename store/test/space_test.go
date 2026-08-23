package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestSpaceStoreMembershipGuards(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "space-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "space-store", Title: "Store Space"}, owner.ID)
	require.NoError(t, err)

	ownerMembership, err := ts.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &owner.ID, ViewerUserID: &owner.ID})
	require.NoError(t, err)
	require.Equal(t, store.SpaceMemberRoleAdmin, ownerMembership.Role)

	created, err := ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, member.ID, created.UserID)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpaceMemberAlreadyExists)

	userRole := store.SpaceMemberRoleUser
	_, err = ts.UpdateSpaceMember(ctx, &store.UpdateSpaceMember{SpaceID: space.ID, UserID: owner.ID, Role: &userRole}, owner.ID)
	require.ErrorIs(t, err, store.ErrLastSpaceAdmin)

	adminRole := store.SpaceMemberRoleAdmin
	_, err = ts.UpdateSpaceMember(ctx, &store.UpdateSpaceMember{SpaceID: space.ID, UserID: member.ID, Role: &adminRole}, owner.ID)
	require.NoError(t, err)
	_, err = ts.UpdateSpaceMember(ctx, &store.UpdateSpaceMember{SpaceID: space.ID, UserID: owner.ID, Role: &userRole}, member.ID)
	require.NoError(t, err)

	require.NoError(t, ts.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: owner.ID}, owner.ID))
	ownerMembership, err = ts.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &owner.ID, ViewerUserID: &member.ID})
	require.NoError(t, err)
	require.Nil(t, ownerMembership)
}

func TestSpaceStoreRequiresTitle(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "space-title-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	_, err = ts.CreateSpace(ctx, nil, owner.ID)
	require.Error(t, err)
	_, err = ts.CreateSpace(ctx, &store.Space{UID: "space-title-empty"}, owner.ID)
	require.Error(t, err)
	_, err = ts.CreateSpace(ctx, &store.Space{UID: "space-title-blank", Title: " \t "}, owner.ID)
	require.Error(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "space-title-preserved", Title: "  Preserved  "}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, "  Preserved  ", space.Title)
	_, err = ts.UpdateSpace(ctx, nil, owner.ID)
	require.Error(t, err)
	_, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID}, owner.ID)
	require.Error(t, err)
	blank := "  "
	_, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Title: &blank}, owner.ID)
	require.Error(t, err)
	stored, err := ts.GetSpace(ctx, &store.FindSpace{ID: &space.ID})
	require.NoError(t, err)
	require.Equal(t, "  Preserved  ", stored.Title)
	_, err = ts.UpdateSpaceMember(ctx, nil, owner.ID)
	require.Error(t, err)
}

func TestSpaceMemoAccessDoesNotFlowAcrossCommentRelation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "memo-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	member, err := ts.CreateUser(ctx, &store.User{Username: "memo-space-member", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	outsider, err := ts.CreateUser(ctx, &store.User{Username: "memo-space-outsider", Role: store.RoleAdmin, PasswordHash: "hash"})
	require.NoError(t, err)

	space, err := ts.CreateSpace(ctx, &store.Space{UID: "memo-space", Title: "Memo Space"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)

	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "space-context", CreatorID: owner.ID, Content: "context", Visibility: store.SpaceAudience, SpaceID: &space.ID,
	})
	require.NoError(t, err)
	_, err = ts.CreateMemo(ctx, &store.Memo{
		UID: "outsider-assigned", CreatorID: outsider.ID, Content: "no", Visibility: store.Public, SpaceID: &space.ID,
	})
	require.ErrorIs(t, err, store.ErrMemoSpaceMembershipRequired)

	comment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "space-public-comment", CreatorID: owner.ID, Content: "public comment", Visibility: store.Public,
	}, contextMemo.ID, owner.ID)
	require.NoError(t, err)
	require.Nil(t, comment.SpaceID)
	require.Equal(t, store.Public, comment.Visibility)

	memberMemos, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &member.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{contextMemo.ID, comment.ID}, memoIDs(memberMemos))

	outsiderMemos, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &outsider.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.Equal(t, []int32{comment.ID}, memoIDs(outsiderMemos), "application ADMIN sees the public comment but cannot inherit its Space context")

	nonComments, err := ts.ListMemos(ctx, &store.FindMemo{
		Access:          &store.MemoAccessScope{UserID: &member.ID, AllowPublic: true, AllowProtected: true},
		ExcludeComments: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int32{contextMemo.ID}, memoIDs(nonComments))
}

func TestUserArchiveAndDeleteRequireLeavingSpaces(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "archive-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	backup, err := ts.CreateUser(ctx, &store.User{Username: "archive-space-backup", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "archive-space", Title: "Archive Space"}, owner.ID)
	require.NoError(t, err)

	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: owner.ID, RowStatus: &archived})
	require.ErrorIs(t, err, store.ErrLastSpaceAdmin)
	_, err = ts.CreateSpaceMember(ctx, &store.SpaceMember{SpaceID: space.ID, UserID: backup.ID, Role: store.SpaceMemberRoleAdmin}, owner.ID)
	require.NoError(t, err)
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: owner.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
	require.ErrorIs(t, err, store.ErrUserHasSpaceMembership)
}

func TestDeleteUserRemovesAuthoredMemoWithoutFollowingComments(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := ts.CreateUser(ctx, &store.User{Username: "delete-comment-user", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	peer, err := ts.CreateUser(ctx, &store.User{Username: "delete-comment-peer", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	contextMemo, err := ts.CreateMemo(ctx, &store.Memo{UID: "peer-context", CreatorID: peer.ID, Content: "context", Visibility: store.Public})
	require.NoError(t, err)
	comment, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "user-comment", CreatorID: user.ID, Content: "comment", Visibility: store.Public,
	}, contextMemo.ID, user.ID)
	require.NoError(t, err)
	reply, err := ts.CreateMemoComment(ctx, &store.Memo{
		UID: "peer-reply", CreatorID: peer.ID, Content: "reply", Visibility: store.Public,
	}, comment.ID, peer.ID)
	require.NoError(t, err)

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
	require.NoError(t, err)
	deletedUser, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Nil(t, deletedUser)
	deletedComment, err := ts.GetMemo(ctx, &store.FindMemo{ID: &comment.ID})
	require.NoError(t, err)
	require.Nil(t, deletedComment)
	for _, memo := range []*store.Memo{contextMemo, reply} {
		remaining, getErr := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
		require.NoError(t, getErr)
		require.NotNil(t, remaining)
	}
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoIDList: []int32{comment.ID}})
	require.NoError(t, err)
	require.Empty(t, relations)
}

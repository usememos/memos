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

	created, err := createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, member.ID, created.UserID)
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
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

func TestSpaceStoreInvitationLifecycle(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "invite-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	invitedAdmin, err := ts.CreateUser(ctx, &store.User{Username: "invited-admin", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	decliningUser, err := ts.CreateUser(ctx, &store.User{Username: "declining-user", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	revokedUser, err := ts.CreateUser(ctx, &store.User{Username: "revoked-user", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	outsider, err := ts.CreateUser(ctx, &store.User{Username: "invite-outsider", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "invitation-lifecycle", Title: "Invitation Lifecycle"}, owner.ID)
	require.NoError(t, err)

	adminInvitation, err := ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  invitedAdmin.ID,
		Role:    store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, store.SpaceMemberRoleAdmin, adminInvitation.Role)
	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  invitedAdmin.ID,
		Role:    store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpaceMemberAlreadyExists)
	archived := store.Archived
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: owner.ID, RowStatus: &archived})
	require.ErrorIs(t, err, store.ErrLastSpaceAdmin, "a pending ADMIN invitation must not satisfy the last-active-admin invariant")

	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  decliningUser.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  revokedUser.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)

	member, err := ts.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &invitedAdmin.ID, ViewerUserID: &owner.ID})
	require.NoError(t, err)
	require.Nil(t, member, "a pending ADMIN invitation must not be a membership")
	spaces, err := ts.ListSpaces(ctx, &store.FindSpace{MemberUserID: &invitedAdmin.ID})
	require.NoError(t, err)
	require.Empty(t, spaces, "a pending ADMIN invitation must not grant space discovery")
	newTitle := "Unauthorized Update"
	_, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Title: &newTitle}, invitedAdmin.ID)
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied)
	err = ts.RevokeSpaceInvitation(ctx, &store.RevokeSpaceInvitation{SpaceID: space.ID, UserID: revokedUser.ID}, invitedAdmin.ID)
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied)

	visibleToInvitee, err := ts.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{ViewerUserID: &invitedAdmin.ID})
	require.NoError(t, err)
	require.Equal(t, []*store.SpaceInvitation{adminInvitation}, visibleToInvitee)
	visibleToOutsider, err := ts.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{ViewerUserID: &outsider.ID})
	require.NoError(t, err)
	require.Empty(t, visibleToOutsider)
	insertUnknownStatus := "INSERT INTO space_member (space_id, user_id, status, role) VALUES (?, ?, 'UNKNOWN', 'ADMIN')"
	if getDriverFromEnv() == "postgres" {
		insertUnknownStatus = "INSERT INTO space_member (space_id, user_id, status, role) VALUES ($1, $2, 'UNKNOWN', 'ADMIN')"
	}
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertUnknownStatus, space.ID, outsider.ID)
	require.NoError(t, err, "status validation belongs to Store logic, not a database CHECK")
	spaces, err = ts.ListSpaces(ctx, &store.FindSpace{MemberUserID: &outsider.ID})
	require.NoError(t, err)
	require.Empty(t, spaces, "an unknown relationship status must fail closed even with an ADMIN role")
	_, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Title: &newTitle}, outsider.ID)
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied)
	visibleToAdmin, err := ts.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{SpaceID: &space.ID, ViewerUserID: &owner.ID})
	require.NoError(t, err)
	require.Len(t, visibleToAdmin, 3)

	_, err = ts.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: space.ID, UserID: invitedAdmin.ID}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied, "an administrator cannot accept on behalf of the invitee")
	accepted, err := ts.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: space.ID, UserID: invitedAdmin.ID}, invitedAdmin.ID)
	require.NoError(t, err)
	require.Equal(t, store.SpaceMemberRoleAdmin, accepted.Role, "accept must preserve the invited role")
	invitation, err := ts.GetSpaceInvitation(ctx, &store.FindSpaceInvitation{SpaceID: &space.ID, UserID: &invitedAdmin.ID, ViewerUserID: &invitedAdmin.ID})
	require.NoError(t, err)
	require.Nil(t, invitation)
	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  invitedAdmin.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpaceMemberAlreadyExists, "an active member conflicts with an invitation")

	err = ts.DeclineSpaceInvitation(ctx, &store.DeclineSpaceInvitation{SpaceID: space.ID, UserID: decliningUser.ID}, owner.ID)
	require.ErrorIs(t, err, store.ErrSpacePermissionDenied, "an administrator cannot decline on behalf of the invitee")
	require.NoError(t, ts.DeclineSpaceInvitation(ctx, &store.DeclineSpaceInvitation{SpaceID: space.ID, UserID: decliningUser.ID}, decliningUser.ID))
	err = ts.DeclineSpaceInvitation(ctx, &store.DeclineSpaceInvitation{SpaceID: space.ID, UserID: decliningUser.ID}, decliningUser.ID)
	require.ErrorIs(t, err, store.ErrSpaceInvitationNotFound)
	require.NoError(t, ts.RevokeSpaceInvitation(ctx, &store.RevokeSpaceInvitation{SpaceID: space.ID, UserID: revokedUser.ID}, owner.ID))
	_, err = ts.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: space.ID, UserID: revokedUser.ID}, revokedUser.ID)
	require.ErrorIs(t, err, store.ErrSpaceInvitationNotFound)
}

func TestDeleteUserCleansPendingSpaceInvitations(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "invitation-delete-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	invitee, err := ts.CreateUser(ctx, &store.User{Username: "invitation-delete-invitee", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "invitation-delete-space", Title: "Invitation deletion"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  invitee.ID,
		Role:    store.SpaceMemberRoleAdmin,
	}, owner.ID)
	require.NoError(t, err)

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: invitee.ID})
	require.NoError(t, err, "a pending invitation must not block account deletion")

	query := "SELECT COUNT(*) FROM space_member WHERE space_id = ? AND user_id = ?"
	if getDriverFromEnv() == "postgres" {
		query = "SELECT COUNT(*) FROM space_member WHERE space_id = $1 AND user_id = $2"
	}
	var count int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, query, space.ID, invitee.ID).Scan(&count))
	require.Zero(t, count, "account deletion must remove its pending invitation row")
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

func TestListSpacesByIDList(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "space-id-list-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)
	first, err := ts.CreateSpace(ctx, &store.Space{UID: "space-id-list-first", Title: "First"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.CreateSpace(ctx, &store.Space{UID: "space-id-list-second", Title: "Second"}, owner.ID)
	require.NoError(t, err)
	third, err := ts.CreateSpace(ctx, &store.Space{UID: "space-id-list-third", Title: "Third"}, owner.ID)
	require.NoError(t, err)

	spaces, err := ts.ListSpaces(ctx, &store.FindSpace{IDList: []int32{first.ID, third.ID}})
	require.NoError(t, err)
	require.Len(t, spaces, 2)
	require.Equal(t, []int32{third.ID, first.ID}, []int32{spaces[0].ID, spaces[1].ID})
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
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: member.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
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
	_, err = createSpaceMemberForTest(ctx, ts, &store.SpaceMember{SpaceID: space.ID, UserID: backup.ID, Role: store.SpaceMemberRoleAdmin}, owner.ID)
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

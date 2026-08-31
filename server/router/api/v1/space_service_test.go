package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"uuid"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func createSpaceTestUser(ctx context.Context, t *testing.T, service *APIV1Service, username string, role store.Role) *store.User {
	t.Helper()
	user, err := service.Store.CreateUser(ctx, &store.User{
		Username: username,
		Role:     role,
		Email:    username + "@example.com",
	})
	require.NoError(t, err)
	return user
}

func inviteSpaceTestUser(ctx context.Context, t *testing.T, service *APIV1Service, inviter, invitee *store.User, space *v1pb.Space, role v1pb.SpaceMember_Role) *v1pb.SpaceInvitation {
	t.Helper()
	invitation, err := service.CreateSpaceInvitation(userCtx(ctx, inviter.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent: space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{
			Invitee: BuildUserName(invitee.Username),
			Role:    role,
		},
	})
	require.NoError(t, err)
	return invitation
}

func inviteAndAcceptSpaceTestUser(ctx context.Context, t *testing.T, service *APIV1Service, inviter, invitee *store.User, space *v1pb.Space, role v1pb.SpaceMember_Role) *v1pb.SpaceMember {
	t.Helper()
	invitation := inviteSpaceTestUser(ctx, t, service, inviter, invitee, space, role)
	membership, err := service.AcceptSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	return membership
}

func TestCreateSpaceGeneratesUUIDV4WhenSpaceUIDIsEmpty(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "space-id-owner", store.RoleUser)

	for _, spaceUID := range []string{"", " \t\n"} {
		space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
			SpaceId: spaceUID,
			Space:   &v1pb.Space{Title: "Same title"},
		})
		require.NoError(t, err)

		uid, err := ExtractSpaceUIDFromName(space.Name)
		require.NoError(t, err)
		parsed, err := uuid.Parse(uid)
		require.NoError(t, err)
		require.Equal(t, parsed.String(), uid, "generated Space UID must be a canonical lowercase UUID")
		require.Equal(t, byte(4), parsed[6]>>4, "generated Space UID must be UUID v4")
	}
}

func TestSpaceServiceMembershipVisibilityAndGovernance(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "space-owner", store.RoleUser)
	member := createSpaceTestUser(ctx, t, service, "space-member", store.RoleUser)
	applicationAdmin := createSpaceTestUser(ctx, t, service, "application-admin", store.RoleAdmin)

	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "team-notes",
		Space:   &v1pb.Space{Title: " Team notes ", Description: " Shared work "},
	})
	require.NoError(t, err)
	require.Equal(t, "spaces/team-notes", space.Name)
	require.Equal(t, "Team notes", space.Title)
	require.Equal(t, v1pb.SpaceMember_ADMIN, space.CurrentUserRole)
	require.Equal(t, int32(1), space.MemberCount)
	_, err = service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "team-notes",
		Space:   &v1pb.Space{Title: "Duplicate"},
	})
	require.Equal(t, codes.AlreadyExists, status.Code(err))

	members, err := service.ListSpaceMembers(userCtx(ctx, owner.ID), &v1pb.ListSpaceMembersRequest{Parent: space.Name})
	require.NoError(t, err)
	require.Len(t, members.SpaceMembers, 1)
	require.Equal(t, v1pb.SpaceMember_ADMIN, members.SpaceMembers[0].Role)

	_, err = service.GetSpace(userCtx(ctx, applicationAdmin.ID), &v1pb.GetSpaceRequest{Name: space.Name})
	require.Equal(t, codes.NotFound, status.Code(err), "application ADMIN must not bypass space membership")
	adminSpaces, err := service.ListSpaces(userCtx(ctx, applicationAdmin.ID), &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Empty(t, adminSpaces.Spaces)

	invitation, err := service.CreateSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.NoError(t, err)
	require.Equal(t, "spaces/team-notes/invitations/space-member", invitation.Name)
	require.Equal(t, space.Name, invitation.Space.Name, "the invitation must identify the Space without granting membership access")
	require.Equal(t, space.Title, invitation.Space.Title)
	require.Equal(t, space.Description, invitation.Space.Description)
	require.Equal(t, v1pb.SpaceMember_ROLE_UNSPECIFIED, invitation.Space.CurrentUserRole)
	require.Zero(t, invitation.Space.MemberCount)

	_, err = service.GetSpace(userCtx(ctx, member.ID), &v1pb.GetSpaceRequest{Name: space.Name})
	require.Equal(t, codes.NotFound, status.Code(err), "a pending invitation must not grant Space access")
	invitedUserSpaces, err := service.ListSpaces(userCtx(ctx, member.ID), &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Empty(t, invitedUserSpaces.Spaces)
	members, err = service.ListSpaceMembers(userCtx(ctx, owner.ID), &v1pb.ListSpaceMembersRequest{Parent: space.Name})
	require.NoError(t, err)
	require.Len(t, members.SpaceMembers, 1, "an invitation must not appear as an active membership")

	spaceInvitations, err := service.ListSpaceInvitations(userCtx(ctx, owner.ID), &v1pb.ListSpaceInvitationsRequest{Parent: space.Name})
	require.NoError(t, err)
	require.Equal(t, []*v1pb.SpaceInvitation{invitation}, spaceInvitations.SpaceInvitations)
	userInvitations, err := service.ListUserSpaceInvitations(userCtx(ctx, member.ID), &v1pb.ListUserSpaceInvitationsRequest{Parent: BuildUserName(member.Username)})
	require.NoError(t, err)
	require.Equal(t, []*v1pb.SpaceInvitation{invitation}, userInvitations.SpaceInvitations)

	_, err = service.CreateSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.AlreadyExists, status.Code(err))
	_, err = service.AcceptSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "an administrator cannot accept for the invitee")

	createdMember, err := service.AcceptSpaceInvitation(userCtx(ctx, member.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	require.Equal(t, "spaces/team-notes/members/space-member", createdMember.Name)
	require.Equal(t, v1pb.SpaceMember_USER, createdMember.Role)
	_, err = service.GetSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.GetSpaceInvitationRequest{Name: invitation.Name})
	require.Equal(t, codes.NotFound, status.Code(err))

	memberSpace, err := service.GetSpace(userCtx(ctx, member.ID), &v1pb.GetSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	require.Equal(t, v1pb.SpaceMember_USER, memberSpace.CurrentUserRole)
	require.Equal(t, int32(2), memberSpace.MemberCount)
	memberSpaces, err := service.ListSpaces(userCtx(ctx, member.ID), &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Len(t, memberSpaces.Spaces, 1)
	require.Equal(t, v1pb.SpaceMember_USER, memberSpaces.Spaces[0].CurrentUserRole)
	require.Equal(t, int32(2), memberSpaces.Spaces[0].MemberCount)
	updatedSpace, err := service.UpdateSpace(userCtx(ctx, owner.ID), &v1pb.UpdateSpaceRequest{
		Space:      &v1pb.Space{Name: space.Name, Title: "Updated team notes"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	require.Equal(t, v1pb.SpaceMember_ADMIN, updatedSpace.CurrentUserRole)
	require.Equal(t, int32(2), updatedSpace.MemberCount)
	_, err = service.UpdateSpace(userCtx(ctx, member.ID), &v1pb.UpdateSpaceRequest{
		Space:      &v1pb.Space{Name: space.Name, Title: "not allowed"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.Equal(t, codes.PermissionDenied, status.Code(err))

	_, err = service.UpdateSpaceMember(userCtx(ctx, owner.ID), &v1pb.UpdateSpaceMemberRequest{
		SpaceMember: &v1pb.SpaceMember{Name: "spaces/team-notes/members/space-owner", Role: v1pb.SpaceMember_USER},
		UpdateMask:  &fieldmaskpb.FieldMask{Paths: []string{"role"}},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err), "the last active ADMIN cannot be demoted")
}

func TestSpaceInvitationDeclineRevokeAndSelectedRole(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "invitation-owner", store.RoleUser)
	invitee := createSpaceTestUser(ctx, t, service, "invitation-invitee", store.RoleUser)
	secondInvitee := createSpaceTestUser(ctx, t, service, "invitation-second", store.RoleUser)
	archivedInvitee := createSpaceTestUser(ctx, t, service, "invitation-archived", store.RoleUser)
	pendingThenArchived := createSpaceTestUser(ctx, t, service, "invitation-pending-archived", store.RoleUser)
	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "invitation-lifecycle",
		Space:   &v1pb.Space{Title: "Invitation lifecycle"},
	})
	require.NoError(t, err)

	invitation := inviteSpaceTestUser(ctx, t, service, owner, invitee, space, v1pb.SpaceMember_ADMIN)
	got, err := service.GetSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.GetSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	require.Equal(t, v1pb.SpaceMember_ADMIN, got.Role)
	_, err = service.DeleteSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.DeleteSpaceInvitationRequest{Name: invitation.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "the invitee cannot revoke an invitation")

	_, err = service.DeleteSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.DeleteSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	_, err = service.AcceptSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.Equal(t, codes.NotFound, status.Code(err), "a revoked invitation cannot be accepted")

	invitation = inviteSpaceTestUser(ctx, t, service, owner, invitee, space, v1pb.SpaceMember_ADMIN)
	_, err = service.DeclineSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.DeclineSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	_, err = service.GetSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.GetSpaceInvitationRequest{Name: invitation.Name})
	require.Equal(t, codes.NotFound, status.Code(err))

	invitation = inviteSpaceTestUser(ctx, t, service, owner, invitee, space, v1pb.SpaceMember_ADMIN)
	membership, err := service.AcceptSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)
	require.Equal(t, v1pb.SpaceMember_ADMIN, membership.Role, "accept must preserve the role selected at invite time")

	secondInvitation := inviteSpaceTestUser(ctx, t, service, owner, secondInvitee, space, v1pb.SpaceMember_USER)
	listed, err := service.ListSpaceInvitations(userCtx(ctx, invitee.ID), &v1pb.ListSpaceInvitationsRequest{Parent: space.Name})
	require.NoError(t, err, "any active Space administrator may manage invitations")
	require.Equal(t, []*v1pb.SpaceInvitation{secondInvitation}, listed.SpaceInvitations)
	_, err = service.AcceptSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.AcceptSpaceInvitationRequest{Name: secondInvitation.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err), "an administrator cannot accept for another user")
	_, err = service.DeleteSpaceInvitation(userCtx(ctx, invitee.ID), &v1pb.DeleteSpaceInvitationRequest{Name: secondInvitation.Name})
	require.NoError(t, err)

	pendingArchivedInvitation := inviteSpaceTestUser(ctx, t, service, owner, pendingThenArchived, space, v1pb.SpaceMember_USER)
	archived := store.Archived
	_, err = service.Store.UpdateUser(ctx, &store.UpdateUser{ID: pendingThenArchived.ID, RowStatus: &archived})
	require.NoError(t, err, "a pending invitation is not an active membership and must not prevent archival")
	listed, err = service.ListSpaceInvitations(userCtx(ctx, owner.ID), &v1pb.ListSpaceInvitationsRequest{Parent: space.Name})
	require.NoError(t, err)
	require.Equal(t, []*v1pb.SpaceInvitation{pendingArchivedInvitation}, listed.SpaceInvitations, "administrators must retain a way to revoke invitations for archived users")
	_, err = service.AcceptSpaceInvitation(userCtx(ctx, pendingThenArchived.ID), &v1pb.AcceptSpaceInvitationRequest{Name: pendingArchivedInvitation.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err), "an archived user cannot accept an invitation")
	_, err = service.DeleteSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.DeleteSpaceInvitationRequest{Name: pendingArchivedInvitation.Name})
	require.NoError(t, err)

	_, err = service.Store.UpdateUser(ctx, &store.UpdateUser{ID: archivedInvitee.ID, RowStatus: &archived})
	require.NoError(t, err)
	_, err = service.CreateSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(archivedInvitee.Username), Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err), "only NORMAL users can be invited")
}

func TestSpaceServiceHardDeleteLifecycle(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "delete-owner", store.RoleUser)
	target := createSpaceTestUser(ctx, t, service, "delete-target", store.RoleUser)
	applicationAdmin := createSpaceTestUser(ctx, t, service, "delete-application-admin", store.RoleAdmin)

	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "delete-space",
		Space:   &v1pb.Space{Title: "Delete me"},
	})
	require.NoError(t, err)
	spaceUID, err := ExtractSpaceUIDFromName(space.Name)
	require.NoError(t, err)
	storedSpace, err := service.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	require.NoError(t, err)
	require.NotNil(t, storedSpace)
	assignedMemo, err := service.Store.CreateMemo(ctx, &store.Memo{
		UID:        "delete-space-memo",
		CreatorID:  owner.ID,
		Content:    "delete with Space",
		Visibility: store.Private,
		SpaceID:    &storedSpace.ID,
	})
	require.NoError(t, err)
	attachmentPath := filepath.Join(t.TempDir(), "space-delete-attachment.txt")
	require.NoError(t, os.WriteFile(attachmentPath, []byte("delete me"), 0o600))
	_, err = service.Store.CreateAttachment(ctx, &store.Attachment{
		UID:         "delete-space-attachment",
		CreatorID:   owner.ID,
		Filename:    "space-delete-attachment.txt",
		MemoID:      &assignedMemo.ID,
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Reference:   attachmentPath,
		Payload:     &storepb.AttachmentPayload{},
	})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, service, owner, target, space, v1pb.SpaceMember_USER)

	_, err = service.UpdateSpace(userCtx(ctx, owner.ID), &v1pb.UpdateSpaceRequest{
		Space:      &v1pb.Space{Name: space.Name},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"state"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err), "Space has no archive or restore state")

	_, err = service.DeleteSpace(userCtx(ctx, target.ID), &v1pb.DeleteSpaceRequest{Name: space.Name})
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	_, err = service.DeleteSpace(userCtx(ctx, applicationAdmin.ID), &v1pb.DeleteSpaceRequest{Name: space.Name})
	require.Equal(t, codes.NotFound, status.Code(err), "application ADMIN must not bypass Space membership")

	_, err = service.DeleteSpace(userCtx(ctx, owner.ID), &v1pb.DeleteSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	require.NoFileExists(t, attachmentPath)
	_, err = service.GetSpace(userCtx(ctx, owner.ID), &v1pb.GetSpaceRequest{Name: space.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	spaces, err := service.ListSpaces(userCtx(ctx, owner.ID), &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Empty(t, spaces.Spaces)
}

func TestSpaceServiceHidesMembershipForInactiveUser(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "inactive-member-owner", store.RoleUser)
	member := createSpaceTestUser(ctx, t, service, "inactive-member", store.RoleUser)

	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "inactive-member-space",
		Space:   &v1pb.Space{Title: "Inactive member space"},
	})
	require.NoError(t, err)
	inviteAndAcceptSpaceTestUser(ctx, t, service, owner, member, space, v1pb.SpaceMember_USER)

	// The normal archive path rejects users with memberships. Simulate an
	// inconsistent row to verify that membership reads still fail closed.
	_, err = service.Store.GetDriver().GetDB().ExecContext(ctx, "UPDATE user SET row_status = 'ARCHIVED' WHERE id = ?", member.ID)
	require.NoError(t, err)

	members, err := service.ListSpaceMembers(userCtx(ctx, owner.ID), &v1pb.ListSpaceMembersRequest{Parent: space.Name})
	require.NoError(t, err)
	require.Len(t, members.SpaceMembers, 1)
	require.Equal(t, BuildUserName(owner.Username), members.SpaceMembers[0].User)

	_, err = service.GetSpaceMember(userCtx(ctx, owner.ID), &v1pb.GetSpaceMemberRequest{
		Name: buildSpaceMemberName("inactive-member-space", member.Username),
	})
	require.Equal(t, codes.NotFound, status.Code(err))
}

func TestUpdateSpaceMemberAcceptsGatewayInferredIdentityMask(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "gateway-owner", store.RoleUser)
	member := createSpaceTestUser(ctx, t, service, "gateway-member", store.RoleUser)

	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "gateway-space",
		Space:   &v1pb.Space{Title: "Gateway Space"},
	})
	require.NoError(t, err)
	createdMember := inviteAndAcceptSpaceTestUser(ctx, t, service, owner, member, space, v1pb.SpaceMember_USER)

	mux := runtime.NewServeMux()
	require.NoError(t, v1pb.RegisterSpaceServiceHandlerServer(ctx, mux, service))
	patchMember := func(body string) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(http.MethodPatch, "/api/v1/"+createdMember.Name, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request = request.WithContext(userCtx(request.Context(), owner.ID))
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		return response
	}

	response := patchMember(`{"user":"users/gateway-member","role":"ADMIN"}`)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())

	spaceUID, err := ExtractSpaceUIDFromName(space.Name)
	require.NoError(t, err)
	storedSpace, err := service.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	require.NoError(t, err)
	require.NotNil(t, storedSpace)
	storedMember, err := service.Store.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &storedSpace.ID, UserID: &member.ID})
	require.NoError(t, err)
	require.NotNil(t, storedMember)
	require.Equal(t, store.SpaceMemberRoleAdmin, storedMember.Role)

	response = patchMember(`{"user":"users/gateway-owner","role":"USER"}`)
	require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
	storedMember, err = service.Store.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &storedSpace.ID, UserID: &member.ID})
	require.NoError(t, err)
	require.NotNil(t, storedMember)
	require.Equal(t, store.SpaceMemberRoleAdmin, storedMember.Role, "a mismatched immutable user must not update the membership")
}

func TestCreateSpaceInvitationClassifiesTargetUserErrors(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "lookup-owner", store.RoleUser)
	target := createSpaceTestUser(ctx, t, service, "lookup-target", store.RoleUser)
	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "lookup-space",
		Space:   &v1pb.Space{Title: "Lookup Space"},
	})
	require.NoError(t, err)

	_, err = service.CreateSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: "invalid-user-name", Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// SQLite permits a text value in this integer column. Corrupt only the
	// target row so authentication and Space authorization still succeed, then
	// require the target lookup failure to remain a server error.
	_, err = service.Store.GetDriver().GetDB().ExecContext(ctx, "UPDATE user SET created_ts = ? WHERE id = ?", "not-an-integer", target.ID)
	require.NoError(t, err)
	_, err = service.CreateSpaceInvitation(userCtx(ctx, owner.ID), &v1pb.CreateSpaceInvitationRequest{
		Parent:          space.Name,
		SpaceInvitation: &v1pb.SpaceInvitation{Invitee: BuildUserName(target.Username), Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.Internal, status.Code(err))
}

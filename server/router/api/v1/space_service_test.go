package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

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

	createdMember, err := service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent: space.Name,
		SpaceMember: &v1pb.SpaceMember{
			User: BuildUserName(member.Username),
			Role: v1pb.SpaceMember_USER,
		},
	})
	require.NoError(t, err)
	require.Equal(t, "spaces/team-notes/members/space-member", createdMember.Name)
	_, err = service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent:      space.Name,
		SpaceMember: &v1pb.SpaceMember{User: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.AlreadyExists, status.Code(err))

	_, err = service.GetSpace(userCtx(ctx, member.ID), &v1pb.GetSpaceRequest{Name: space.Name})
	require.NoError(t, err)
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
	_, err = service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent:      space.Name,
		SpaceMember: &v1pb.SpaceMember{User: BuildUserName(target.Username), Role: v1pb.SpaceMember_USER},
	})
	require.NoError(t, err)

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
	_, err = service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent:      space.Name,
		SpaceMember: &v1pb.SpaceMember{User: BuildUserName(member.Username), Role: v1pb.SpaceMember_USER},
	})
	require.NoError(t, err)

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
	createdMember, err := service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent: space.Name,
		SpaceMember: &v1pb.SpaceMember{
			User: BuildUserName(member.Username),
			Role: v1pb.SpaceMember_USER,
		},
	})
	require.NoError(t, err)

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

func TestCreateSpaceMemberClassifiesTargetUserErrors(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "lookup-owner", store.RoleUser)
	target := createSpaceTestUser(ctx, t, service, "lookup-target", store.RoleUser)
	space, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{
		SpaceId: "lookup-space",
		Space:   &v1pb.Space{Title: "Lookup Space"},
	})
	require.NoError(t, err)

	_, err = service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent:      space.Name,
		SpaceMember: &v1pb.SpaceMember{User: "invalid-user-name", Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// SQLite permits a text value in this integer column. Corrupt only the
	// target row so authentication and Space authorization still succeed, then
	// require the target lookup failure to remain a server error.
	_, err = service.Store.GetDriver().GetDB().ExecContext(ctx, "UPDATE user SET created_ts = ? WHERE id = ?", "not-an-integer", target.ID)
	require.NoError(t, err)
	_, err = service.CreateSpaceMember(userCtx(ctx, owner.ID), &v1pb.CreateSpaceMemberRequest{
		Parent:      space.Name,
		SpaceMember: &v1pb.SpaceMember{User: BuildUserName(target.Username), Role: v1pb.SpaceMember_USER},
	})
	require.Equal(t, codes.Internal, status.Code(err))
}

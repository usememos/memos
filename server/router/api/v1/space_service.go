package v1

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) requireCurrentSpaceUser(ctx context.Context) (*store.User, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	return user, nil
}

func (s *APIV1Service) resolveMemberSpace(ctx context.Context, name string, currentUser *store.User) (*store.Space, *store.SpaceMember, error) {
	uid, err := ExtractSpaceUIDFromName(name)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid space name: %v", err)
	}
	space, err := s.Store.GetSpace(ctx, &store.FindSpace{UID: &uid, MemberUserID: &currentUser.ID})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get space: %v", err)
	}
	if space == nil {
		return nil, nil, status.Error(codes.NotFound, "space not found")
	}
	member, err := s.Store.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &currentUser.ID})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get space membership: %v", err)
	}
	if member == nil || !member.Role.IsActiveMember() {
		// A non-member must not be able to distinguish an existing private
		// collaboration boundary from a missing resource.
		return nil, nil, status.Error(codes.NotFound, "space not found")
	}
	return space, member, nil
}

func requireSpaceAdministrator(member *store.SpaceMember) error {
	if member == nil || member.Role != store.SpaceMemberRoleAdmin {
		return status.Error(codes.PermissionDenied, "space administrator permission required")
	}
	return nil
}

func mapSpaceMutationError(err error, operation string) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, store.ErrLastSpaceAdmin):
		return status.Error(codes.FailedPrecondition, "a space must retain an active administrator")
	case errors.Is(err, store.ErrSpacePermissionDenied):
		return status.Error(codes.NotFound, "space not found")
	case errors.Is(err, store.ErrSpaceMemberNotActive):
		return status.Error(codes.FailedPrecondition, "space members must be active users")
	case errors.Is(err, store.ErrSpaceAlreadyExists):
		return status.Error(codes.AlreadyExists, "space already exists")
	case errors.Is(err, store.ErrSpaceMemberAlreadyExists):
		return status.Error(codes.AlreadyExists, "space membership or invitation already exists")
	case errors.Is(err, store.ErrSpaceInvitationNotFound):
		return status.Error(codes.NotFound, "space invitation not found")
	case errors.Is(err, store.ErrSpaceNotFound), errors.Is(err, store.ErrSpaceMemberNotFound):
		return status.Error(codes.NotFound, "space or membership not found")
	case errors.Is(err, sql.ErrNoRows):
		return status.Error(codes.NotFound, "space or membership not found")
	default:
		return status.Errorf(codes.Internal, "%s: %v", operation, err)
	}
}

// CreateSpace creates a space with the caller as its first administrator.
func (s *APIV1Service) CreateSpace(ctx context.Context, request *v1pb.CreateSpaceRequest) (*v1pb.Space, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetSpace() == nil {
		return nil, status.Error(codes.InvalidArgument, "space is required")
	}
	title := strings.TrimSpace(request.Space.Title)
	if title == "" {
		return nil, status.Error(codes.InvalidArgument, "space title is required")
	}
	uid, err := ValidateAndGenerateUID(request.SpaceId)
	if err != nil {
		return nil, err
	}
	created, err := s.Store.CreateSpace(ctx, &store.Space{
		UID:         uid,
		Title:       title,
		Description: strings.TrimSpace(request.Space.Description),
	}, currentUser.ID)
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to create space")
	}
	s.SSEHub.publishMemoChanged()
	return convertSpaceFromStore(created), nil
}

// ListSpaces lists only spaces with a membership for the caller.
func (s *APIV1Service) ListSpaces(ctx context.Context, request *v1pb.ListSpacesRequest) (*v1pb.ListSpacesResponse, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	limit, offset, err := listSpacePage(request.PageSize, request.PageToken)
	if err != nil {
		return nil, err
	}
	limitPlusOne := limit + 1
	spaces, err := s.Store.ListSpaces(ctx, &store.FindSpace{
		MemberUserID: &currentUser.ID,
		Limit:        &limitPlusOne,
		Offset:       &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list spaces: %v", err)
	}

	nextPageToken := ""
	if len(spaces) == limitPlusOne {
		spaces = spaces[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create next page token: %v", err)
		}
	}
	response := &v1pb.ListSpacesResponse{Spaces: make([]*v1pb.Space, 0, len(spaces)), NextPageToken: nextPageToken}
	for _, space := range spaces {
		response.Spaces = append(response.Spaces, convertSpaceFromStore(space))
	}
	return response, nil
}

func listSpacePage(pageSize int32, pageToken string) (int, int, error) {
	if pageToken == "" {
		return normalizePageSize(pageSize), 0, nil
	}
	var token v1pb.PageToken
	if err := unmarshalPageToken(pageToken, &token); err != nil {
		return 0, 0, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
	}
	return normalizePageSize(token.Limit), max(int(token.Offset), 0), nil
}

// GetSpace gets a space visible to the caller through membership.
func (s *APIV1Service) GetSpace(ctx context.Context, request *v1pb.GetSpaceRequest) (*v1pb.Space, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, _, err := s.resolveMemberSpace(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	return convertSpaceFromStore(space), nil
}

// UpdateSpace updates Space metadata.
func (s *APIV1Service) UpdateSpace(ctx context.Context, request *v1pb.UpdateSpaceRequest) (*v1pb.Space, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetSpace() == nil {
		return nil, status.Error(codes.InvalidArgument, "space is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Error(codes.InvalidArgument, "update mask is required")
	}
	space, membership, err := s.resolveMemberSpace(ctx, request.Space.Name, currentUser)
	if err != nil {
		return nil, err
	}
	if err := requireSpaceAdministrator(membership); err != nil {
		return nil, err
	}

	update := &store.UpdateSpace{ID: space.ID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			title := strings.TrimSpace(request.Space.Title)
			if title == "" {
				return nil, status.Error(codes.InvalidArgument, "space title is required")
			}
			update.Title = &title
		case "description":
			description := strings.TrimSpace(request.Space.Description)
			update.Description = &description
		default:
			return nil, status.Errorf(codes.InvalidArgument, "unsupported update mask path: %s", path)
		}
	}
	updated, err := s.Store.UpdateSpace(ctx, update, currentUser.ID)
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to update space")
	}
	if updated == nil {
		return nil, status.Error(codes.NotFound, "space not found")
	}
	s.SSEHub.publishMemoChanged()
	return convertSpaceFromStore(updated), nil
}

// DeleteSpace permanently deletes the Space and every memo directly placed
// in it. The result deliberately exposes no memo inventory to the administrator.
func (s *APIV1Service) DeleteSpace(ctx context.Context, request *v1pb.DeleteSpaceRequest) (*emptypb.Empty, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, membership, err := s.resolveMemberSpace(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	if err := requireSpaceAdministrator(membership); err != nil {
		return nil, err
	}
	deleteResult, err := s.Store.DeleteSpace(ctx, &store.DeleteSpace{ID: space.ID, ActorUserID: currentUser.ID})
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to delete space")
	}
	s.SSEHub.publishMemoChanged()
	if err := s.cleanupDeletedAttachmentStorage(ctx, deleteResult.Attachments); err != nil {
		return nil, status.Errorf(codes.Internal, "space was deleted but attachment storage cleanup failed: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// CreateSpaceInvitation creates a pending invitation without granting any
// Space access to the invitee.
func (s *APIV1Service) CreateSpaceInvitation(ctx context.Context, request *v1pb.CreateSpaceInvitationRequest) (*v1pb.SpaceInvitation, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetSpaceInvitation() == nil {
		return nil, status.Error(codes.InvalidArgument, "space invitation is required")
	}
	space, callerMembership, err := s.resolveMemberSpace(ctx, request.Parent, currentUser)
	if err != nil {
		return nil, err
	}
	if err := requireSpaceAdministrator(callerMembership); err != nil {
		return nil, err
	}
	targetUsername, err := parseUsernameFromName(request.SpaceInvitation.Invitee)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid invitation invitee: %v", err)
	}
	targetUser, err := s.Store.GetUser(ctx, &store.FindUser{Username: &targetUsername})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get invitation invitee: %v", err)
	}
	if targetUser == nil {
		return nil, status.Error(codes.NotFound, "user not found")
	}
	if targetUser.RowStatus != store.Normal {
		return nil, status.Error(codes.FailedPrecondition, "only active users can be invited to a space")
	}
	role, ok := convertSpaceMemberRoleToStore(request.SpaceInvitation.Role)
	if !ok {
		return nil, status.Error(codes.InvalidArgument, "space invitation role must be ADMIN or USER")
	}
	expectedName := buildSpaceInvitationName(space.UID, targetUser.Username)
	if request.SpaceInvitation.Name != "" && request.SpaceInvitation.Name != expectedName {
		return nil, status.Error(codes.InvalidArgument, "space invitation name does not match parent and invitee")
	}
	created, err := s.Store.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: space.ID,
		UserID:  targetUser.ID,
		Role:    role,
	}, currentUser.ID)
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to create space invitation")
	}
	s.SSEHub.publishMemoChanged()
	return convertSpaceInvitationFromStore(space, targetUser, created), nil
}

// ListSpaceInvitations lists pending invitations after requiring an active
// Space administrator.
func (s *APIV1Service) ListSpaceInvitations(ctx context.Context, request *v1pb.ListSpaceInvitationsRequest) (*v1pb.ListSpaceInvitationsResponse, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, callerMembership, err := s.resolveMemberSpace(ctx, request.Parent, currentUser)
	if err != nil {
		return nil, err
	}
	if err := requireSpaceAdministrator(callerMembership); err != nil {
		return nil, err
	}
	limit, offset, err := listSpacePage(request.PageSize, request.PageToken)
	if err != nil {
		return nil, err
	}
	limitPlusOne := limit + 1
	invitations, err := s.Store.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{
		SpaceID:      &space.ID,
		ViewerUserID: &currentUser.ID,
		Limit:        &limitPlusOne,
		Offset:       &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list space invitations: %v", err)
	}
	nextPageToken := ""
	if len(invitations) == limitPlusOne {
		invitations = invitations[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create next page token: %v", err)
		}
	}
	response := &v1pb.ListSpaceInvitationsResponse{
		SpaceInvitations: make([]*v1pb.SpaceInvitation, 0, len(invitations)),
		NextPageToken:    nextPageToken,
	}
	if len(invitations) == 0 {
		return response, nil
	}
	userIDs := make([]int32, 0, len(invitations))
	for _, invitation := range invitations {
		userIDs = append(userIDs, invitation.UserID)
	}
	users, err := s.Store.ListUsers(ctx, &store.FindUser{IDList: userIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve invitation invitees: %v", err)
	}
	usersByID := make(map[int32]*store.User, len(users))
	for _, user := range users {
		usersByID[user.ID] = user
	}
	for _, invitation := range invitations {
		user := usersByID[invitation.UserID]
		if user == nil || convertSpaceMemberRoleFromStore(invitation.Role) == v1pb.SpaceMember_ROLE_UNSPECIFIED {
			continue
		}
		response.SpaceInvitations = append(response.SpaceInvitations, convertSpaceInvitationFromStore(space, user, invitation))
	}
	return response, nil
}

// ListUserSpaceInvitations lists the authenticated user's received pending
// invitations. A user cannot enumerate another user's invitations.
func (s *APIV1Service) ListUserSpaceInvitations(ctx context.Context, request *v1pb.ListUserSpaceInvitationsRequest) (*v1pb.ListUserSpaceInvitationsResponse, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	username, err := parseUsernameFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user parent: %v", err)
	}
	if username != currentUser.Username {
		return nil, status.Error(codes.PermissionDenied, "users may only list their own space invitations")
	}
	limit, offset, err := listSpacePage(request.PageSize, request.PageToken)
	if err != nil {
		return nil, err
	}
	limitPlusOne := limit + 1
	invitations, err := s.Store.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{
		UserID:       &currentUser.ID,
		ViewerUserID: &currentUser.ID,
		Limit:        &limitPlusOne,
		Offset:       &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user space invitations: %v", err)
	}
	nextPageToken := ""
	if len(invitations) == limitPlusOne {
		invitations = invitations[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create next page token: %v", err)
		}
	}
	response := &v1pb.ListUserSpaceInvitationsResponse{
		SpaceInvitations: make([]*v1pb.SpaceInvitation, 0, len(invitations)),
		NextPageToken:    nextPageToken,
	}
	if len(invitations) == 0 {
		return response, nil
	}
	spaceIDs := make([]int32, 0, len(invitations))
	for _, invitation := range invitations {
		spaceIDs = append(spaceIDs, invitation.SpaceID)
	}
	spaces, err := s.Store.ListSpaces(ctx, &store.FindSpace{IDList: spaceIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve invitation spaces: %v", err)
	}
	spacesByID := make(map[int32]*store.Space, len(spaces))
	for _, space := range spaces {
		spacesByID[space.ID] = space
	}
	for _, invitation := range invitations {
		space := spacesByID[invitation.SpaceID]
		if space == nil || convertSpaceMemberRoleFromStore(invitation.Role) == v1pb.SpaceMember_ROLE_UNSPECIFIED {
			continue
		}
		response.SpaceInvitations = append(response.SpaceInvitations, convertSpaceInvitationFromStore(space, currentUser, invitation))
	}
	return response, nil
}

// resolveSpaceInvitationResource resolves an invitation and authorizes either
// its invitee or an active administrator of its Space.
func (s *APIV1Service) resolveSpaceInvitationResource(ctx context.Context, name string, currentUser *store.User) (*store.Space, *store.User, *store.SpaceMember, *store.SpaceInvitation, error) {
	spaceUID, username, err := ExtractSpaceInvitationTokensFromName(name)
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.InvalidArgument, "invalid space invitation name: %v", err)
	}
	space, err := s.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to resolve invitation space: %v", err)
	}
	if space == nil {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space invitation not found")
	}
	targetUser, err := s.Store.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to resolve invitation invitee: %v", err)
	}
	if targetUser == nil {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space invitation not found")
	}
	callerMembership, err := s.Store.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &space.ID, UserID: &currentUser.ID})
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to resolve caller space membership: %v", err)
	}
	isInvitee := targetUser.ID == currentUser.ID
	isAdministrator := callerMembership != nil && callerMembership.Role == store.SpaceMemberRoleAdmin
	if !isInvitee && !isAdministrator {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space invitation not found")
	}
	invitation, err := s.Store.GetSpaceInvitation(ctx, &store.FindSpaceInvitation{
		SpaceID:      &space.ID,
		UserID:       &targetUser.ID,
		ViewerUserID: &currentUser.ID,
	})
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to get space invitation: %v", err)
	}
	if invitation == nil || convertSpaceMemberRoleFromStore(invitation.Role) == v1pb.SpaceMember_ROLE_UNSPECIFIED {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space invitation not found")
	}
	return space, targetUser, callerMembership, invitation, nil
}

// GetSpaceInvitation gets a pending invitation for its invitee or a Space
// administrator.
func (s *APIV1Service) GetSpaceInvitation(ctx context.Context, request *v1pb.GetSpaceInvitationRequest) (*v1pb.SpaceInvitation, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, targetUser, _, invitation, err := s.resolveSpaceInvitationResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	return convertSpaceInvitationFromStore(space, targetUser, invitation), nil
}

// DeleteSpaceInvitation revokes a pending invitation. Only an active Space
// administrator can revoke it.
func (s *APIV1Service) DeleteSpaceInvitation(ctx context.Context, request *v1pb.DeleteSpaceInvitationRequest) (*emptypb.Empty, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	_, targetUser, callerMembership, invitation, err := s.resolveSpaceInvitationResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	if err := requireSpaceAdministrator(callerMembership); err != nil {
		return nil, err
	}
	if err := s.Store.RevokeSpaceInvitation(ctx, &store.RevokeSpaceInvitation{
		SpaceID: invitation.SpaceID,
		UserID:  targetUser.ID,
	}, currentUser.ID); err != nil {
		return nil, mapSpaceMutationError(err, "failed to revoke space invitation")
	}
	s.SSEHub.publishMemoChanged()
	return &emptypb.Empty{}, nil
}

// AcceptSpaceInvitation activates the invited user's membership with the role
// selected by the administrator who created the invitation.
func (s *APIV1Service) AcceptSpaceInvitation(ctx context.Context, request *v1pb.AcceptSpaceInvitationRequest) (*v1pb.SpaceMember, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, targetUser, _, invitation, err := s.resolveSpaceInvitationResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	if targetUser.ID != currentUser.ID {
		return nil, status.Error(codes.PermissionDenied, "only the invitee may accept a space invitation")
	}
	member, err := s.Store.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: invitation.SpaceID, UserID: currentUser.ID}, currentUser.ID)
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to accept space invitation")
	}
	s.SSEHub.publishMemoChanged()
	return convertSpaceMemberFromStore(space, currentUser, member), nil
}

// DeclineSpaceInvitation deletes the authenticated invitee's pending
// invitation without ever creating a membership.
func (s *APIV1Service) DeclineSpaceInvitation(ctx context.Context, request *v1pb.DeclineSpaceInvitationRequest) (*emptypb.Empty, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	_, targetUser, _, invitation, err := s.resolveSpaceInvitationResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	if targetUser.ID != currentUser.ID {
		return nil, status.Error(codes.PermissionDenied, "only the invitee may decline a space invitation")
	}
	if err := s.Store.DeclineSpaceInvitation(ctx, &store.DeclineSpaceInvitation{SpaceID: invitation.SpaceID, UserID: currentUser.ID}, currentUser.ID); err != nil {
		return nil, mapSpaceMutationError(err, "failed to decline space invitation")
	}
	s.SSEHub.publishMemoChanged()
	return &emptypb.Empty{}, nil
}

// ListSpaceMembers lists memberships after authorizing the caller's own
// membership before applying pagination.
func (s *APIV1Service) ListSpaceMembers(ctx context.Context, request *v1pb.ListSpaceMembersRequest) (*v1pb.ListSpaceMembersResponse, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, _, err := s.resolveMemberSpace(ctx, request.Parent, currentUser)
	if err != nil {
		return nil, err
	}
	limit, offset, err := listSpacePage(request.PageSize, request.PageToken)
	if err != nil {
		return nil, err
	}
	limitPlusOne := limit + 1
	members, err := s.Store.ListSpaceMembers(ctx, &store.FindSpaceMember{
		SpaceID:      &space.ID,
		ViewerUserID: &currentUser.ID,
		Limit:        &limitPlusOne,
		Offset:       &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list space members: %v", err)
	}
	nextPageToken := ""
	if len(members) == limitPlusOne {
		members = members[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create next page token: %v", err)
		}
	}
	response := &v1pb.ListSpaceMembersResponse{SpaceMembers: make([]*v1pb.SpaceMember, 0, len(members)), NextPageToken: nextPageToken}
	if len(members) == 0 {
		return response, nil
	}

	userIDs := make([]int32, 0, len(members))
	for _, member := range members {
		userIDs = append(userIDs, member.UserID)
	}
	users, err := s.Store.ListUsers(ctx, &store.FindUser{IDList: userIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to resolve space members: %v", err)
	}
	usersByID := make(map[int32]*store.User, len(users))
	for _, user := range users {
		usersByID[user.ID] = user
	}
	for _, member := range members {
		user := usersByID[member.UserID]
		if user == nil || user.RowStatus != store.Normal || convertSpaceMemberRoleFromStore(member.Role) == v1pb.SpaceMember_ROLE_UNSPECIFIED {
			// Malformed/dangling memberships are never exposed as active access.
			continue
		}
		response.SpaceMembers = append(response.SpaceMembers, convertSpaceMemberFromStore(space, user, member))
	}
	return response, nil
}

func (s *APIV1Service) resolveSpaceMemberResource(ctx context.Context, name string, currentUser *store.User) (*store.Space, *store.User, *store.SpaceMember, *store.SpaceMember, error) {
	spaceUID, username, err := ExtractSpaceMemberTokensFromName(name)
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.InvalidArgument, "invalid space member name: %v", err)
	}
	space, callerMembership, err := s.resolveMemberSpace(ctx, buildSpaceName(spaceUID), currentUser)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	targetUser, err := ResolveUserByName(ctx, s.Store, BuildUserName(username))
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to resolve member user: %v", err)
	}
	if targetUser == nil {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space member not found")
	}
	if targetUser.RowStatus != store.Normal {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space member not found")
	}
	targetMembership, err := s.Store.GetSpaceMember(ctx, &store.FindSpaceMember{
		SpaceID:      &space.ID,
		UserID:       &targetUser.ID,
		ViewerUserID: &currentUser.ID,
	})
	if err != nil {
		return nil, nil, nil, nil, status.Errorf(codes.Internal, "failed to get space membership: %v", err)
	}
	if targetMembership == nil || !targetMembership.Role.IsActiveMember() {
		return nil, nil, nil, nil, status.Error(codes.NotFound, "space member not found")
	}
	return space, targetUser, callerMembership, targetMembership, nil
}

// GetSpaceMember gets one membership visible to another member of the space.
func (s *APIV1Service) GetSpaceMember(ctx context.Context, request *v1pb.GetSpaceMemberRequest) (*v1pb.SpaceMember, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	space, targetUser, _, membership, err := s.resolveSpaceMemberResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	return convertSpaceMemberFromStore(space, targetUser, membership), nil
}

// UpdateSpaceMember changes a member's role in a Space.
func (s *APIV1Service) UpdateSpaceMember(ctx context.Context, request *v1pb.UpdateSpaceMemberRequest) (*v1pb.SpaceMember, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.GetSpaceMember() == nil {
		return nil, status.Error(codes.InvalidArgument, "space member is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Error(codes.InvalidArgument, "update mask must include role")
	}
	roleIncluded := false
	userIncluded := false
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "role":
			roleIncluded = true
		case "user":
			// grpc-gateway infers user from the schema-required REST body. It is
			// accepted as immutable identity context, never as a mutable field.
			userIncluded = true
		default:
			return nil, status.Errorf(codes.InvalidArgument, "unsupported update mask path: %s", path)
		}
	}
	if !roleIncluded {
		return nil, status.Error(codes.InvalidArgument, "update mask must include role")
	}
	space, targetUser, callerMembership, targetMembership, err := s.resolveSpaceMemberResource(ctx, request.SpaceMember.Name, currentUser)
	if err != nil {
		return nil, err
	}
	expectedUser := BuildUserName(targetUser.Username)
	if userIncluded && request.SpaceMember.User == "" {
		return nil, status.Error(codes.InvalidArgument, "space member user is required when included in the update mask")
	}
	if request.SpaceMember.User != "" && request.SpaceMember.User != expectedUser {
		return nil, status.Error(codes.InvalidArgument, "space member user does not match name")
	}
	if err := requireSpaceAdministrator(callerMembership); err != nil {
		return nil, err
	}
	role, ok := convertSpaceMemberRoleToStore(request.SpaceMember.Role)
	if !ok {
		return nil, status.Error(codes.InvalidArgument, "space member role must be ADMIN or USER")
	}
	updated, err := s.Store.UpdateSpaceMember(ctx, &store.UpdateSpaceMember{
		SpaceID: targetMembership.SpaceID,
		UserID:  targetMembership.UserID,
		Role:    &role,
	}, currentUser.ID)
	if err != nil {
		return nil, mapSpaceMutationError(err, "failed to update space member")
	}
	if updated == nil {
		return nil, status.Error(codes.NotFound, "space member not found")
	}
	s.SSEHub.publishMemoChanged()
	return convertSpaceMemberFromStore(space, targetUser, updated), nil
}

// DeleteSpaceMember removes a membership or lets a member leave a space.
func (s *APIV1Service) DeleteSpaceMember(ctx context.Context, request *v1pb.DeleteSpaceMemberRequest) (*emptypb.Empty, error) {
	currentUser, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	_, targetUser, callerMembership, targetMembership, err := s.resolveSpaceMemberResource(ctx, request.Name, currentUser)
	if err != nil {
		return nil, err
	}
	isSelf := targetUser.ID == currentUser.ID
	if !isSelf {
		if err := requireSpaceAdministrator(callerMembership); err != nil {
			return nil, err
		}
	}
	if err := s.Store.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{
		SpaceID: targetMembership.SpaceID,
		UserID:  targetMembership.UserID,
	}, currentUser.ID); err != nil {
		return nil, mapSpaceMutationError(err, "failed to delete space member")
	}
	s.SSEHub.publishMemoChanged()
	return &emptypb.Empty{}, nil
}

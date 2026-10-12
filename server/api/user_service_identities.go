package api

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func (s *APIService) ListLinkedIdentities(ctx context.Context, request *apipb.ListLinkedIdentitiesRequest) (*apipb.ListLinkedIdentitiesResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}
	userID := user.ID

	if _, err := s.authorizeUserResourceAccess(ctx, userID, true); err != nil {
		return nil, err
	}

	identities, err := s.Store.ListUserIdentities(ctx, &store.FindUserIdentity{UserID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list linked identities: %v", err)
	}

	response := &apipb.ListLinkedIdentitiesResponse{
		LinkedIdentities: []*apipb.LinkedIdentity{},
	}
	for _, identity := range identities {
		response.LinkedIdentities = append(response.LinkedIdentities, convertLinkedIdentityFromStore(user, identity))
	}
	return response, nil
}

func (s *APIService) CreateLinkedIdentity(ctx context.Context, request *apipb.CreateLinkedIdentityRequest) (*apipb.LinkedIdentity, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	identityProvider, userInfo, err := s.resolveSSOIdentity(ctx, request.IdentityProvider, request.Code, request.RedirectUri, request.CodeVerifier)
	if err != nil {
		return nil, err
	}
	provider := identityProvider.Uid
	externUID := userInfo.Identifier

	if _, err := s.bindSSOIdentityToUser(ctx, currentUser, provider, externUID); err != nil {
		return nil, err
	}

	identity, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		UserID:   &currentUser.ID,
		Provider: &provider,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get linked identity: %v", err)
	}
	if identity == nil {
		return nil, status.Errorf(codes.Internal, "linked identity not found after creation")
	}

	return convertLinkedIdentityFromStore(user, identity), nil
}

func (s *APIService) GetLinkedIdentity(ctx context.Context, request *apipb.GetLinkedIdentityRequest) (*apipb.LinkedIdentity, error) {
	user, provider, err := s.resolveUserAndLinkedIdentityProviderFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid linked identity name: %v", err)
	}
	userID := user.ID

	if _, err := s.authorizeUserResourceAccess(ctx, userID, true); err != nil {
		return nil, err
	}

	identity, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		UserID:   &userID,
		Provider: &provider,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get linked identity: %v", err)
	}
	if identity == nil {
		return nil, status.Errorf(codes.NotFound, "linked identity not found")
	}

	return convertLinkedIdentityFromStore(user, identity), nil
}

func (s *APIService) DeleteLinkedIdentity(ctx context.Context, request *apipb.DeleteLinkedIdentityRequest) (*emptypb.Empty, error) {
	user, provider, err := s.resolveUserAndLinkedIdentityProviderFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid linked identity name: %v", err)
	}
	userID := user.ID

	if _, err := s.authorizeUserResourceAccess(ctx, userID, true); err != nil {
		return nil, err
	}

	existing, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		UserID:   &userID,
		Provider: &provider,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get linked identity: %v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "linked identity not found")
	}

	if err := s.Store.DeleteUserIdentities(ctx, &store.DeleteUserIdentity{
		UserID:   &userID,
		Provider: &provider,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete linked identity: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// ListPersonalAccessTokens retrieves all Personal Access Tokens (PATs) for a user.
//
// Personal Access Tokens are used for:
// - Mobile app authentication
// - CLI tool authentication
// - API client authentication
// - Any programmatic access requiring Bearer token auth
//
// Security:
// - Only the token owner can list their tokens
// - Returns token metadata only (not the actual token value)
// - Invalid or expired tokens are filtered out
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only list their own tokens.

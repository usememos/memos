package v1

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
)

func (s *APIV1Service) ListPersonalAccessTokens(ctx context.Context, request *v1pb.ListPersonalAccessTokensRequest) (*v1pb.ListPersonalAccessTokensResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	userID := user.ID

	// Verify permission
	if _, err := s.authorizeUserResourceAccess(ctx, userID, true); err != nil {
		return nil, err
	}

	tokens, err := s.Store.GetUserPersonalAccessTokens(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get access tokens: %v", err)
	}

	personalAccessTokens := make([]*v1pb.PersonalAccessToken, len(tokens))
	for i, token := range tokens {
		personalAccessTokens[i] = &v1pb.PersonalAccessToken{
			Name:        fmt.Sprintf("%s/personalAccessTokens/%s", BuildUserName(user.Username), token.TokenId),
			Description: token.Description,
			ExpiresAt:   token.ExpiresAt,
			CreatedAt:   token.CreatedAt,
			LastUsedAt:  token.LastUsedAt,
		}
	}

	return &v1pb.ListPersonalAccessTokensResponse{PersonalAccessTokens: personalAccessTokens}, nil
}

// CreatePersonalAccessToken creates a new Personal Access Token (PAT) for a user.
//
// Use cases:
// - User manually creates token in settings for mobile app
// - User creates token for CLI tool
// - User creates token for third-party integration
//
// Token properties:
// - Random string with memos_pat_ prefix
// - SHA-256 hash stored in database
// - Optional expiration time (can be never-expiring)
// - User-provided description for identification
//
// Security considerations:
// - Full token is only shown ONCE (in this response)
// - User should copy and store it securely
// - Token can be revoked by deleting it from settings
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only create tokens for themselves.
func (s *APIV1Service) CreatePersonalAccessToken(ctx context.Context, request *v1pb.CreatePersonalAccessTokenRequest) (*v1pb.CreatePersonalAccessTokenResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	userID := user.ID

	// Verify permission
	if _, err := s.authorizeUserResourceAccess(ctx, userID, false); err != nil {
		return nil, err
	}

	// Generate PAT
	tokenID := util.GenUUID()
	token := auth.GeneratePersonalAccessToken()
	tokenHash := auth.HashPersonalAccessToken(token)

	var expiresAt *timestamppb.Timestamp
	if request.ExpiresInDays > 0 {
		expiresAt = timestamppb.New(time.Now().AddDate(0, 0, int(request.ExpiresInDays)))
	}

	patRecord := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     tokenID,
		TokenHash:   tokenHash,
		Description: request.Description,
		ExpiresAt:   expiresAt,
		CreatedAt:   timestamppb.Now(),
	}

	if err := s.Store.AddUserPersonalAccessToken(ctx, userID, patRecord); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create access token: %v", err)
	}

	return &v1pb.CreatePersonalAccessTokenResponse{
		PersonalAccessToken: &v1pb.PersonalAccessToken{
			Name:        fmt.Sprintf("%s/personalAccessTokens/%s", BuildUserName(user.Username), tokenID),
			Description: request.Description,
			ExpiresAt:   expiresAt,
			CreatedAt:   patRecord.CreatedAt,
		},
		Token: token, // Only returned on creation
	}, nil
}

// DeletePersonalAccessToken revokes a Personal Access Token.
//
// This endpoint:
// 1. Removes the token from the user's access tokens list
// 2. Immediately invalidates the token (subsequent API calls with it will fail)
//
// Use cases:
// - User revokes a compromised token
// - User removes token for unused app/device
// - User cleans up old tokens
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only delete their own tokens.
func (s *APIV1Service) DeletePersonalAccessToken(ctx context.Context, request *v1pb.DeletePersonalAccessTokenRequest) (*emptypb.Empty, error) {
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "personalAccessTokens" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid personal access token name")
	}

	user, err := s.resolveUserFromName(ctx, BuildUserName(parts[1]))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	userID := user.ID
	tokenID := parts[3]

	// Verify permission
	if _, err := s.authorizeUserResourceAccess(ctx, userID, false); err != nil {
		return nil, err
	}

	if err := s.Store.RemoveUserPersonalAccessToken(ctx, userID, tokenID); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete access token: %v", err)
	}

	return &emptypb.Empty{}, nil
}

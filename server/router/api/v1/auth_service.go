package v1

import (
	"context"

	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	unmatchedUsernameAndPasswordError = "unmatched username and password"
)

// GetCurrentUser returns the authenticated user's information.
// Validates the access token and returns user details.
//
// Authentication: Required (access token).
// Returns: User information.
func (s *APIV1Service) GetCurrentUser(ctx context.Context, _ *v1pb.GetCurrentUserRequest) (*v1pb.GetCurrentUserResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Clear auth cookies
		if err := s.clearAuthCookies(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to clear auth cookies: %v", err)
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}

	return &v1pb.GetCurrentUserResponse{
		User: convertUserFromStore(user, user),
	}, nil
}

// SignIn authenticates a user with credentials and returns tokens.
// On success, returns an access token and sets a refresh token cookie.
//
// Supports two authentication methods:
// 1. Password-based authentication (username + password).
// 2. SSO authentication (OAuth2 authorization code).
//
// Authentication: Not required (public endpoint).
// Returns: User info, access token, and token expiry.
func (s *APIV1Service) SignIn(ctx context.Context, request *v1pb.SignInRequest) (*v1pb.SignInResponse, error) {
	var existingUser *store.User

	// Authentication Method 1: Password-based authentication
	if passwordCredentials := request.GetPasswordCredentials(); passwordCredentials != nil {
		user, err := s.Store.GetUser(ctx, &store.FindUser{
			Username: &passwordCredentials.Username,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		// Compare the stored hashed password, with the hashed version of the password that was received.
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(passwordCredentials.Password)); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
		}
		instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
		}
		// Check if the password auth in is allowed.
		if instanceGeneralSetting.DisallowPasswordAuth && user.Role == store.RoleUser {
			return nil, status.Errorf(codes.PermissionDenied, "password signin is not allowed")
		}
		existingUser = user
	} else if ssoCredentials := request.GetSsoCredentials(); ssoCredentials != nil {
		// Authentication Method 2: SSO (OAuth2) authentication
		identityProvider, userInfo, err := s.resolveSSOIdentity(ctx, ssoCredentials.IdpName, ssoCredentials.Code, ssoCredentials.RedirectUri, ssoCredentials.CodeVerifier)
		if err != nil {
			return nil, err
		}
		user, err := s.resolveSSOUser(ctx, nil, identityProvider, userInfo)
		if err != nil {
			return nil, err
		}
		existingUser = user
	}

	if existingUser == nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid credentials")
	}
	if existingUser.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, "user has been archived with username %s", existingUser.Username)
	}

	accessToken, accessExpiresAt, err := s.doSignIn(ctx, existingUser)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in: %v", err)
	}

	return &v1pb.SignInResponse{
		User:                 convertUserFromStore(existingUser, existingUser),
		AccessToken:          accessToken,
		AccessTokenExpiresAt: timestamppb.New(accessExpiresAt),
	}, nil
}

// resolveSSOUser resolves a local user from an external-identity subject, creating the
// linkage record (and a new local user if necessary) when first login is allowed.
//
// Lookup goes through the user_identity table so that userInfo.Identifier is never used
// as the local username key. On the miss path, a local user is created with a
// UUID-backed local username (see deriveSSOUsername) and the (provider, extern_uid)
// linkage is inserted in the same flow. When currentUser is provided by a caller
// outside AuthService.SignIn, the lookup miss path binds the external identity to
// that existing user instead. If the linkage insert loses a race on the unique
// (provider, extern_uid) constraint, the winning linkage's user is loaded and
// checked against the current user.

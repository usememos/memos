package v1

import (
	"context"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/idp"
	"github.com/usememos/memos/internal/idp/oauth2"
	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) resolveSSOUser(ctx context.Context, currentUser *store.User, identityProvider *storepb.IdentityProvider, userInfo *idp.IdentityProviderUserInfo) (*store.User, error) {
	provider := identityProvider.Uid
	externUID := userInfo.Identifier

	user, err := s.getLinkedSSOUser(ctx, provider, externUID)
	if err != nil {
		return nil, err
	}
	if user != nil {
		if currentUser != nil && currentUser.ID != user.ID {
			return nil, status.Errorf(codes.AlreadyExists, "identity provider account is already linked to another user")
		}
		return user, nil
	}

	if currentUser != nil {
		return s.bindSSOIdentityToUser(ctx, currentUser, provider, externUID)
	}

	// Miss path: enforce the registration gate before creating anything.
	instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
	}
	if instanceGeneralSetting.DisallowUserRegistration {
		return nil, status.Errorf(codes.PermissionDenied, "user registration is not allowed")
	}

	password, err := util.RandomString(20)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate random password, error: %v", err)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate password hash, error: %v", err)
	}
	username, err := deriveSSOUsername()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to derive username, error: %v", err)
	}
	user, err = s.Store.CreateUser(ctx, &store.User{
		Username:     username,
		Role:         store.RoleUser,
		Nickname:     userInfo.DisplayName,
		Email:        userInfo.Email,
		AvatarURL:    userInfo.AvatarURL,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user, error: %v", err)
	}

	if _, err := s.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    user.ID,
		Provider:  provider,
		ExternUID: externUID,
	}); err != nil {
		// Best-effort cleanup: the provisional user row has no linkage and should not remain.
		_, _ = s.Store.DeleteUser(ctx, &store.DeleteUser{ID: user.ID})
		if isUniqueConstraintViolation(err) {
			// Concurrent first login won the race; load the winning linkage's user.
			winner, getErr := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
				Provider:  &provider,
				ExternUID: &externUID,
			})
			if getErr != nil {
				return nil, status.Errorf(codes.Internal, "failed to reload user identity after race, error: %v", getErr)
			}
			if winner == nil {
				return nil, status.Errorf(codes.Internal, "user identity conflict reported but no winning row found")
			}
			winnerUser, getErr := s.Store.GetUser(ctx, &store.FindUser{ID: &winner.UserID})
			if getErr != nil {
				return nil, status.Errorf(codes.Internal, "failed to get user after race, error: %v", getErr)
			}
			if winnerUser == nil {
				return nil, status.Errorf(codes.Internal, "linked user %d not found after race", winner.UserID)
			}
			return winnerUser, nil
		}
		return nil, status.Errorf(codes.Internal, "failed to create user identity, error: %v", err)
	}
	return user, nil
}

func (s *APIV1Service) resolveSSOIdentity(ctx context.Context, idpName, code, redirectURI, codeVerifier string) (*storepb.IdentityProvider, *idp.IdentityProviderUserInfo, error) {
	idpUID, err := ExtractIdentityProviderUIDFromName(idpName)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		UID: &idpUID,
	})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %v", err)
	}
	if identityProvider == nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "identity provider not found")
	}

	var userInfo *idp.IdentityProviderUserInfo
	if identityProvider.Type == storepb.IdentityProvider_OAUTH2 {
		oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProvider.Config.GetOauth2Config())
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "failed to create oauth2 identity provider, error: %v", err)
		}
		// Pass code_verifier for PKCE support (empty string if not provided for backward compatibility)
		token, err := oauth2IdentityProvider.ExchangeToken(ctx, redirectURI, code, codeVerifier)
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "failed to exchange token, error: %v", err)
		}
		userInfo, err = oauth2IdentityProvider.UserInfo(ctx, token)
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "failed to get user info, error: %v", err)
		}
	}

	identifierFilter := identityProvider.IdentifierFilter
	if identifierFilter != "" {
		identifierFilterRegex, err := regexp.Compile(identifierFilter)
		if err != nil {
			return nil, nil, status.Errorf(codes.Internal, "failed to compile identifier filter regex, error: %v", err)
		}
		if !identifierFilterRegex.MatchString(userInfo.Identifier) {
			return nil, nil, status.Errorf(codes.PermissionDenied, "identifier %s is not allowed", userInfo.Identifier)
		}
	}

	return identityProvider, userInfo, nil
}

func (s *APIV1Service) getLinkedSSOUser(ctx context.Context, provider, externUID string) (*store.User, error) {
	identity, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		Provider:  &provider,
		ExternUID: &externUID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user identity, error: %v", err)
	}
	if identity == nil {
		return nil, nil
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &identity.UserID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Internal, "linked user %d not found for identity %d", identity.UserID, identity.ID)
	}
	return user, nil
}

func (s *APIV1Service) bindSSOIdentityToUser(ctx context.Context, currentUser *store.User, provider, externUID string) (*store.User, error) {
	existingForProvider, err := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		UserID:   &currentUser.ID,
		Provider: &provider,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get existing linked identity, error: %v", err)
	}
	if existingForProvider != nil {
		if existingForProvider.ExternUID == externUID {
			return currentUser, nil
		}
		return nil, status.Errorf(codes.AlreadyExists, "identity provider is already linked to another external account for this user")
	}

	if _, err := s.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    currentUser.ID,
		Provider:  provider,
		ExternUID: externUID,
	}); err != nil {
		if isUniqueConstraintViolation(err) {
			winner, getErr := s.getLinkedSSOUser(ctx, provider, externUID)
			if getErr != nil {
				return nil, getErr
			}
			if winner != nil {
				if winner.ID != currentUser.ID {
					return nil, status.Errorf(codes.AlreadyExists, "identity provider account is already linked to another user")
				}
				return currentUser, nil
			}

			existingForProvider, getErr := s.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
				UserID:   &currentUser.ID,
				Provider: &provider,
			})
			if getErr != nil {
				return nil, status.Errorf(codes.Internal, "failed to reload linked identity after race, error: %v", getErr)
			}
			if existingForProvider != nil {
				if existingForProvider.ExternUID == externUID {
					return currentUser, nil
				}
				return nil, status.Errorf(codes.AlreadyExists, "identity provider is already linked to another external account for this user")
			}

			return nil, status.Errorf(codes.Internal, "user identity conflict reported but no winning row found")
		}
		return nil, status.Errorf(codes.Internal, "failed to create user identity, error: %v", err)
	}
	return currentUser, nil
}

// isUniqueConstraintViolation matches the driver-specific error messages that each
// supported backend emits when any UNIQUE constraint rejects an insert. Callers
// disambiguate which constraint was hit from the insertion context (e.g. inserting
// a user_identity row can only violate UNIQUE(provider, extern_uid); inserting a
// user row can only violate UNIQUE(username)). Matches the pattern used in
// memo_service.go for the memo UID unique check.
func isUniqueConstraintViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "Duplicate entry")
}

// doSignIn performs the actual sign-in operation by creating a session and setting the cookie.
//
// This function:
// 1. Generates refresh token and access token.
// 2. Stores refresh token metadata in user_setting.
// 3. Sets refresh token as HttpOnly cookie.
// 4. Returns access token and its expiry time.

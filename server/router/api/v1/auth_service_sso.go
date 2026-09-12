package v1

import (
	"context"
	"log/slog"
	"regexp"

	"github.com/pkg/errors"
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
	// Defense in depth: an empty subject must never key a lookup or provision an
	// account, regardless of whether the IdP layer already rejected it.
	if externUID == "" {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider returned an empty subject identifier")
	}

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
	email := s.resolveSSOEmail(ctx, userInfo.Email, provider, externUID)
	user, err = s.createSSOUser(ctx, userInfo, email, string(passwordHash), provider, externUID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user, error: %v", err)
	}
	return user, nil
}

// resolveSSOEmail decides which address a newly provisioned SSO user gets. A
// malformed address, or one another account already holds, yields no address
// at all: an identity provider's claim is not proof of ownership on this
// instance, so the new account is never linked to the existing holder. The
// database index remains the guarantee; a concurrent claim between this check
// and the insert is handled by createSSOUser.
func (s *APIV1Service) resolveSSOEmail(ctx context.Context, rawEmail, provider, externUID string) string {
	email, err := util.NormalizeEmail(rawEmail)
	if err != nil {
		slog.Warn("ignoring malformed email from identity provider",
			slog.String("provider", provider),
			slog.String("externUID", externUID),
			slog.String("error", err.Error()))
		return ""
	}
	if email == "" {
		return ""
	}
	holder, err := s.Store.GetUser(ctx, &store.FindUser{Email: &email})
	if err != nil {
		slog.Warn("unable to check identity provider email; provisioning without one",
			slog.String("provider", provider),
			slog.String("externUID", externUID),
			slog.String("error", err.Error()))
		return ""
	}
	if holder != nil {
		slog.Warn("identity provider email already belongs to another account; provisioning without one",
			slog.String("provider", provider),
			slog.String("externUID", externUID),
			slog.String("holder", holder.Username))
		return ""
	}
	return email
}

// createSSOUser prefers the mapped external identifier as the initial local
// username when it satisfies the local username rules. A database uniqueness
// conflict falls back to a generated UUID instead of linking the SSO identity to
// the existing same-named account. User and identity creation are committed
// atomically so a concurrent UUID fallback cannot win after another request has
// claimed the preferred username.
//
// tryUsername returns a non-nil user when the identity is resolved (either newly
// created or reconciled to a concurrent winner) and (nil, nil) when the username
// is already taken and the caller should retry with a different one.
func (s *APIV1Service) createSSOUser(
	ctx context.Context,
	userInfo *idp.IdentityProviderUserInfo,
	email string,
	passwordHash string,
	provider string,
	externUID string,
) (*store.User, error) {
	tryUsername := func(username string) (*store.User, error) {
		create := func(email string) (*store.User, error) {
			return s.Store.CreateUserWithIdentity(ctx, &store.User{
				Username:     username,
				Role:         store.RoleUser,
				Nickname:     userInfo.DisplayName,
				Email:        email,
				AvatarURL:    userInfo.AvatarURL,
				PasswordHash: passwordHash,
			}, &store.UserIdentity{
				Provider:  provider,
				ExternUID: externUID,
			})
		}
		user, err := create(email)
		if errors.Is(err, store.ErrEmailTaken) {
			// Another account claimed the address between the pre-check and the
			// insert. The address is dropped, never the account.
			slog.Warn("identity provider email was claimed concurrently; provisioning without one",
				slog.String("provider", provider),
				slog.String("externUID", externUID))
			email = ""
			user, err = create(email)
		}
		if err == nil {
			return user, nil
		}
		switch {
		case errors.Is(err, store.ErrUserIdentityTaken):
			// A concurrent first login won; reconcile to its user. Supported
			// databases only report the competing unique-key violation after the
			// winner commits, so its identity linkage is visible to this read.
			return s.getLinkedSSOUser(ctx, provider, externUID)
		case errors.Is(err, store.ErrUsernameTaken):
			// The username is in use by another account; signal a retry with a
			// fresh username.
			return nil, nil
		default:
			return nil, err
		}
	}

	// Adopt any valid external identifier. Invalid names fall back to an opaque UUID.
	if err := validateWritableUsername(userInfo.Identifier); err == nil {
		user, err := tryUsername(userInfo.Identifier)
		if err != nil {
			return nil, err
		}
		if user != nil {
			return user, nil
		}
	}

	for range ssoUsernameFallbackAttempts {
		username, err := deriveSSOUsername()
		if err != nil {
			return nil, err
		}
		user, err := tryUsername(username)
		if err != nil {
			return nil, err
		}
		if user != nil {
			return user, nil
		}
	}

	return nil, errors.Errorf("exhausted %d UUID username attempts", ssoUsernameFallbackAttempts)
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
		if errors.Is(err, store.ErrUserIdentityTaken) {
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

// doSignIn performs the actual sign-in operation by creating a session and setting the cookie.
//
// This function:
// 1. Generates refresh token and access token.
// 2. Stores refresh token metadata in user_setting.
// 3. Sets refresh token as HttpOnly cookie.
// 4. Returns access token and its expiry time.

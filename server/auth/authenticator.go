package auth

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Authenticator provides shared authentication and authorization logic.
// Used by gRPC interceptor, Connect interceptor, and file server to ensure
// consistent authentication behavior across all API endpoints.
//
// Authentication methods:
// - JWT access tokens: Short-lived tokens (15 minutes) for API access
// - Personal Access Tokens (PAT): Long-lived tokens for programmatic access
//
// This struct is safe for concurrent use.
type Authenticator struct {
	store  *store.Store
	secret string
}

// NewAuthenticator creates a new Authenticator instance.
func NewAuthenticator(store *store.Store, secret string) *Authenticator {
	return &Authenticator{
		store:  store,
		secret: secret,
	}
}

// AuthenticateByAccessTokenV2 validates a short-lived access token.
// Returns claims without database query (stateless validation).
func (a *Authenticator) AuthenticateByAccessTokenV2(accessToken string) (*UserClaims, error) {
	claims, err := ParseAccessTokenV2(accessToken, []byte(a.secret))
	if err != nil {
		return nil, errors.Wrap(err, "invalid access token")
	}

	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return nil, errors.Wrap(err, "invalid user ID in token")
	}

	return &UserClaims{
		UserID:   userID,
		Username: claims.Username,
		Role:     claims.Role,
		Status:   claims.Status,
	}, nil
}

// AuthenticateByRefreshToken validates a refresh token against the database.
func (a *Authenticator) AuthenticateByRefreshToken(ctx context.Context, refreshToken string) (*store.User, string, error) {
	claims, err := ParseRefreshToken(refreshToken, []byte(a.secret))
	if err != nil {
		return nil, "", errors.Wrap(err, "invalid refresh token")
	}

	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return nil, "", errors.Wrap(err, "invalid user ID in token")
	}

	// Check token exists in database (revocation check)
	token, err := a.store.GetUserRefreshTokenByID(ctx, userID, claims.TokenID)
	if err != nil {
		return nil, "", errors.Wrap(err, "failed to get refresh token")
	}
	if token == nil {
		return nil, "", errors.New("refresh token revoked")
	}

	// Check token not expired
	if token.ExpiresAt != nil && token.ExpiresAt.AsTime().Before(time.Now()) {
		return nil, "", errors.New("refresh token expired")
	}

	// Get user
	user, err := a.store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, "", errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, "", errors.New("user not found")
	}
	if user.RowStatus == store.Archived {
		return nil, "", errors.New("user is archived")
	}

	return user, claims.TokenID, nil
}

// AuthenticateByPAT validates a Personal Access Token.
func (a *Authenticator) AuthenticateByPAT(ctx context.Context, token string) (*store.User, *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, error) {
	if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		return nil, nil, errors.New("invalid PAT format")
	}

	tokenHash := HashPersonalAccessToken(token)
	result, err := a.store.GetUserByPATHash(ctx, tokenHash)
	if err != nil {
		return nil, nil, errors.Wrap(err, "invalid PAT")
	}

	// Check expiry
	if result.PAT.ExpiresAt != nil && result.PAT.ExpiresAt.AsTime().Before(time.Now()) {
		return nil, nil, errors.New("PAT expired")
	}

	// Check user status
	if result.User.RowStatus == store.Archived {
		return nil, nil, errors.New("user is archived")
	}

	return result.User, result.PAT, nil
}

// AuthResult contains the result of an authentication attempt.
type AuthResult struct {
	User        *store.User // Set for PAT authentication
	Claims      *UserClaims // Set for Access Token V2 (stateless)
	AccessToken string      // Non-empty if authenticated via JWT
}

// Authenticate tries to authenticate using the provided credentials.
// Priority: 1. Access Token V2, 2. PAT
// Returns nil if no valid credentials are provided.
func (a *Authenticator) Authenticate(ctx context.Context, authHeader string) *AuthResult {
	token := ExtractBearerToken(authHeader)

	// Try Access Token V2 (stateless)
	if token != "" && !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		claims, err := a.AuthenticateByAccessTokenV2(token)
		if err == nil && claims != nil {
			return &AuthResult{
				Claims:      claims,
				AccessToken: token,
			}
		}
	}

	// Try PAT
	if token != "" && strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		user, pat, err := a.AuthenticateByPAT(ctx, token)
		if err == nil && user != nil {
			// Update last used (fire-and-forget with logging)
			go func() {
				if err := a.store.UpdatePATLastUsed(context.Background(), user.ID, pat.TokenId, timestamppb.Now()); err != nil {
					slog.Warn("failed to update PAT last used time", "error", err, "userID", user.ID)
				}
			}()
			return &AuthResult{User: user, AccessToken: token}
		}
	}

	return nil
}

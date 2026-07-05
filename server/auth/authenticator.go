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

// bearerAuth is the outcome of successfully validating a Bearer token: the resolved
// user plus the credential-specific detail needed to build an AuthResult.
type bearerAuth struct {
	user   *store.User
	claims *UserClaims                                                  // set for an Access Token V2
	pat    *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken // set for a Personal Access Token
}

// resolveBearer validates a Bearer token — an Access Token V2 or a Personal Access
// Token — into an active user. It returns:
//   - (nil, nil)    when the token is absent, malformed, expired, unknown, or resolves
//     to a missing/archived user (callers may then fall back to other credentials);
//   - (nil, err)    on an unexpected store error;
//   - (result, nil) on success.
//
// It performs no side effects; callers decide whether to record PAT usage.
func (a *Authenticator) resolveBearer(ctx context.Context, token string) (*bearerAuth, error) {
	if token == "" {
		return nil, nil
	}

	if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		// Access Token V2 (stateless). An invalid token yields no identity and no
		// error, so the caller can fall back to other credentials.
		claims, err := a.AuthenticateByAccessTokenV2(token)
		if err == nil && claims != nil {
			user, err := a.store.GetUser(ctx, &store.FindUser{ID: &claims.UserID})
			if err != nil {
				return nil, err
			}
			if user != nil && user.RowStatus != store.Archived {
				return &bearerAuth{user: user, claims: claims}, nil
			}
		}
		return nil, nil
	}

	// Personal Access Token.
	if user, pat, err := a.AuthenticateByPAT(ctx, token); err == nil && user != nil {
		return &bearerAuth{user: user, pat: pat}, nil
	}
	return nil, nil
}

// recordPATUsage updates a personal access token's last-used timestamp
// asynchronously; failures are logged and never affect the request.
func (a *Authenticator) recordPATUsage(userID int32, tokenID string) {
	go func() {
		if err := a.store.UpdatePATLastUsed(context.Background(), userID, tokenID, timestamppb.Now()); err != nil {
			slog.Warn("failed to update PAT last used time", "error", err, "userID", userID)
		}
	}()
}

// AuthenticateToUser resolves the current request to a *store.User, checking the
// Authorization header first (access token or PAT), then falling back to the
// refresh token cookie. Returns (nil, nil) when no valid credentials are present.
func (a *Authenticator) AuthenticateToUser(ctx context.Context, authHeader, cookieHeader string) (*store.User, error) {
	bearer, err := a.resolveBearer(ctx, ExtractBearerToken(authHeader))
	if err != nil {
		return nil, err
	}
	if bearer != nil {
		return bearer.user, nil
	}

	// Fallback: refresh token cookie.
	if cookieHeader != "" {
		if refreshToken := ExtractRefreshTokenFromCookie(cookieHeader); refreshToken != "" {
			user, _, err := a.AuthenticateByRefreshToken(ctx, refreshToken)
			return user, err
		}
	}

	return nil, nil
}

// Authenticate resolves a Bearer token (Access Token V2 or PAT) into an AuthResult,
// returning nil when no valid credentials are present. Unlike AuthenticateToUser it
// ignores the refresh cookie, and it records PAT last-used on success.
func (a *Authenticator) Authenticate(ctx context.Context, authHeader string) *AuthResult {
	token := ExtractBearerToken(authHeader)
	bearer, err := a.resolveBearer(ctx, token)
	if err != nil || bearer == nil {
		return nil
	}
	if bearer.pat != nil {
		a.recordPATUsage(bearer.user.ID, bearer.pat.TokenId)
		return &AuthResult{User: bearer.user, AccessToken: token}
	}
	return &AuthResult{Claims: bearer.claims, AccessToken: token}
}

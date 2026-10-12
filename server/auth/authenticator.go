package auth

import (
	"context"
	"crypto/hmac"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

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
// Checks the user's current account state and password-bound session hash.
func (a *Authenticator) AuthenticateByAccessTokenV2(ctx context.Context, accessToken string) (*UserClaims, error) {
	result, err := a.resolveAccessToken(ctx, accessToken)
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, errors.New("invalid access token")
	}
	return result.claims, nil
}

// resolveAccessToken returns nil for invalid credentials and an error for store failures.
func (a *Authenticator) resolveAccessToken(ctx context.Context, accessToken string) (*bearerAuth, error) {
	claims, err := ParseAccessTokenV2(accessToken, []byte(a.secret))
	if err != nil {
		return nil, nil //nolint:nilerr // Invalid credentials permit fallback; only store failures are errors.
	}

	userID, err := parseInt32(claims.Subject)
	if err != nil {
		return nil, nil //nolint:nilerr // Invalid credentials permit fallback; only store failures are errors.
	}
	user, err := a.store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get access token user")
	}
	if user == nil || user.RowStatus == store.Archived {
		return nil, nil
	}
	if !hmac.Equal([]byte(claims.AuthHash), []byte(accessTokenAuthHash(user.ID, user.PasswordHash, []byte(a.secret)))) {
		return nil, nil
	}

	return &bearerAuth{
		user: user,
		claims: &UserClaims{
			UserID:   userID,
			Username: claims.Username,
			Role:     claims.Role,
			Status:   claims.Status,
		},
	}, nil
}

// AuthenticateByRefreshToken validates a refresh token against the database.
func (a *Authenticator) AuthenticateByRefreshToken(ctx context.Context, refreshToken string) (*store.User, string, error) {
	claims, err := ParseRefreshToken(refreshToken, []byte(a.secret))
	if err != nil {
		return nil, "", errors.Wrap(err, "invalid refresh token")
	}

	userID, err := parseInt32(claims.Subject)
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

// ErrInvalidPAT marks a Personal Access Token that cannot authenticate: it is
// malformed, unknown, expired, or belongs to a missing or archived user. Any
// other error from AuthenticateByPAT means the lookup itself failed.
var ErrInvalidPAT = errors.New("invalid PAT")

// AuthenticateByPAT validates a Personal Access Token. A rejected token yields an
// error wrapping ErrInvalidPAT; a store failure yields any other error.
func (a *Authenticator) AuthenticateByPAT(ctx context.Context, token string) (*store.User, *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, error) {
	if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		return nil, nil, errors.Wrap(ErrInvalidPAT, "invalid PAT format")
	}

	tokenHash := HashPersonalAccessToken(token)
	result, err := a.store.GetUserByPATHash(ctx, tokenHash)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to look up PAT")
	}
	if result == nil {
		return nil, nil, errors.Wrap(ErrInvalidPAT, "PAT not found")
	}

	if result.PAT.ExpiresAt != nil && result.PAT.ExpiresAt.AsTime().Before(time.Now()) {
		return nil, nil, errors.Wrap(ErrInvalidPAT, "PAT expired")
	}

	if result.User.RowStatus == store.Archived {
		return nil, nil, errors.Wrap(ErrInvalidPAT, "user is archived")
	}

	return result.User, result.PAT, nil
}

// AuthResult contains the result of an authentication attempt.
type AuthResult struct {
	User        *store.User // Set for PAT authentication
	Claims      *UserClaims // Set for Access Token V2
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
// Successful PAT resolution records the token's last-used time, so every entry
// point that authenticates through here gets usage tracking for free.
func (a *Authenticator) resolveBearer(ctx context.Context, token string) (*bearerAuth, error) {
	if token == "" {
		return nil, nil
	}

	if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
		return a.resolveAccessToken(ctx, token)
	}

	// Personal Access Token. A rejected token yields no identity and no error; a
	// store failure propagates so it is never mistaken for bad credentials.
	user, pat, err := a.AuthenticateByPAT(ctx, token)
	if err != nil {
		if errors.Is(err, ErrInvalidPAT) {
			return nil, nil
		}
		return nil, err
	}
	a.recordPATUsage(user.ID, pat.TokenId)
	return &bearerAuth{user: user, pat: pat}, nil
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
// ignores the refresh cookie. A store failure also yields nil, so the caller is
// treated as anonymous, but it is logged so operators can tell it apart from a
// rejected token.
func (a *Authenticator) Authenticate(ctx context.Context, authHeader string) *AuthResult {
	token := ExtractBearerToken(authHeader)
	bearer, err := a.resolveBearer(ctx, token)
	if err != nil {
		slog.Error("failed to resolve bearer token", "error", err)
		return nil
	}
	if bearer == nil {
		return nil
	}
	if bearer.pat != nil {
		return &AuthResult{User: bearer.user, AccessToken: token}
	}
	return &AuthResult{Claims: bearer.claims, AccessToken: token}
}

func parseInt32(src string) (int32, error) {
	parsed, err := strconv.ParseInt(src, 10, 32)
	if err != nil {
		return 0, err
	}
	return int32(parsed), nil
}

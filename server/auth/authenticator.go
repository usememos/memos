package auth

import (
	"context"
	"time"

	"github.com/golang-jwt/jwt/v5"
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
// - Session cookie: Browser-based authentication with sliding expiration
// - JWT token: API token authentication for programmatic access
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

// AuthenticateBySession validates a session cookie and returns the authenticated user.
//
// Validation steps:
// 1. Use session ID to find the user and session details (single DB query)
// 2. Verify user exists and is not archived
// 3. Check session hasn't expired (sliding expiration: 14 days from last access)
//
// Returns the user if authentication succeeds, or an error describing the failure.
func (a *Authenticator) AuthenticateBySession(ctx context.Context, sessionID string) (*store.User, error) {
	if sessionID == "" {
		return nil, errors.New("session ID not found")
	}

	// Find the session and user in a single database query
	result, err := a.store.GetUserSessionByID(ctx, sessionID)
	if err != nil {
		return nil, errors.Wrap(err, "session not found")
	}

	user, err := a.store.GetUser(ctx, &store.FindUser{ID: &result.UserID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	if user.RowStatus == store.Archived {
		return nil, errors.New("user is archived")
	}

	// Validate session expiration
	if result.Session.LastAccessedTime != nil {
		expiration := result.Session.LastAccessedTime.AsTime().Add(SessionSlidingDuration)
		if expiration.Before(time.Now()) {
			return nil, errors.New("session expired")
		}
	}

	return user, nil
}

// AuthenticateByJWT validates a JWT access token and returns the authenticated user.
//
// Validation steps:
// 1. Parse and verify JWT signature using server secret
// 2. Verify key ID matches expected version
// 3. Extract user ID from JWT claims (subject field)
// 4. Verify user exists and is not archived
// 5. Verify token exists in user's access_tokens list (for revocation support)
//
// Returns the user if authentication succeeds, or an error describing the failure.
func (a *Authenticator) AuthenticateByJWT(ctx context.Context, accessToken string) (*store.User, error) {
	if accessToken == "" {
		return nil, errors.New("access token not found")
	}

	claims := &ClaimsMessage{}
	_, err := jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, errors.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, ok := t.Header["kid"].(string)
		if !ok || kid != KeyID {
			return nil, errors.Errorf("unexpected kid: %v", t.Header["kid"])
		}
		return []byte(a.secret), nil
	})
	if err != nil {
		return nil, errors.New("invalid or expired access token")
	}

	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return nil, errors.Wrap(err, "malformed ID in token")
	}

	user, err := a.store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, errors.Errorf("user %d not found", userID)
	}
	if user.RowStatus == store.Archived {
		return nil, errors.Errorf("user %d is archived", userID)
	}

	accessTokens, err := a.store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user access tokens")
	}
	if !validateAccessToken(accessToken, accessTokens) {
		return nil, errors.New("invalid access token")
	}

	return user, nil
}

// AuthorizeAndSetContext checks user authorization for the given procedure and sets context values.
//
// Authorization checks:
// - Admin-only methods require Host or Admin role (checked via isAdminOnly function)
//
// Context values set:
// - UserIDContextKey: Always set with the user's ID
// - SessionIDContextKey: Set if authenticated via session cookie
// - AccessTokenContextKey: Set if authenticated via JWT token
//
// Also updates session last accessed time for session-based auth (sliding expiration).
//
// Returns the updated context or an error if authorization fails.
func (a *Authenticator) AuthorizeAndSetContext(ctx context.Context, procedure string, user *store.User, sessionID, accessToken string, isAdminOnly func(string) bool) (context.Context, error) {
	// Check admin-only method authorization
	if isAdminOnly != nil && isAdminOnly(procedure) && user.Role != store.RoleHost && user.Role != store.RoleAdmin {
		return nil, errors.Errorf("user %q is not authorized for this operation", user.Username)
	}

	// Set user ID in context (always)
	ctx = context.WithValue(ctx, UserIDContextKey, user.ID)

	// Set authentication method specific context values
	if sessionID != "" {
		ctx = context.WithValue(ctx, SessionIDContextKey, sessionID)
		// Update session last accessed time for sliding expiration
		_ = a.store.UpdateUserSessionLastAccessed(ctx, user.ID, sessionID, timestamppb.Now())
	} else if accessToken != "" {
		ctx = context.WithValue(ctx, AccessTokenContextKey, accessToken)
	}

	return ctx, nil
}

// validateAccessToken checks if the token exists in the user's access tokens list.
// This enables token revocation: deleted tokens are removed from the list.
func validateAccessToken(token string, tokens []*storepb.AccessTokensUserSetting_AccessToken) bool {
	for _, t := range tokens {
		if token == t.AccessToken {
			return true
		}
	}
	return false
}

// UpdateSessionLastAccessed updates the last accessed time for a session.
// This implements sliding expiration - sessions remain valid as long as they're used.
// Should be called after successful session-based authentication.
func (a *Authenticator) UpdateSessionLastAccessed(ctx context.Context, userID int32, sessionID string) {
	// Fire-and-forget update; failures are logged but don't block the request
	_ = a.store.UpdateUserSessionLastAccessed(ctx, userID, sessionID, timestamppb.Now())
}

// AuthResult contains the result of an authentication attempt.
type AuthResult struct {
	User        *store.User
	SessionID   string // Non-empty if authenticated via session cookie
	AccessToken string // Non-empty if authenticated via JWT
}

// Authenticate tries to authenticate using the provided credentials.
// It tries session cookie first, then JWT token.
// Returns nil if no valid credentials are provided.
// On successful session auth, it also updates the session sliding expiration.
func (a *Authenticator) Authenticate(ctx context.Context, sessionID, authHeader string) *AuthResult {
	// Try session cookie authentication first
	if sessionID != "" {
		user, err := a.AuthenticateBySession(ctx, sessionID)
		if err == nil && user != nil {
			a.UpdateSessionLastAccessed(ctx, user.ID, sessionID)
			return &AuthResult{User: user, SessionID: sessionID}
		}
	}

	// Try JWT token authentication
	if token := ExtractBearerToken(authHeader); token != "" {
		user, err := a.AuthenticateByJWT(ctx, token)
		if err == nil && user != nil {
			return &AuthResult{User: user, AccessToken: token}
		}
	}

	return nil
}

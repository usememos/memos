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
// 1. Parse cookie value to extract userID and sessionID
// 2. Verify user exists and is not archived
// 3. Verify session exists in user's sessions list
// 4. Check session hasn't expired (sliding expiration: 14 days from last access)
//
// Returns the user if authentication succeeds, or an error describing the failure.
func (a *Authenticator) AuthenticateBySession(ctx context.Context, sessionCookieValue string) (*store.User, error) {
	if sessionCookieValue == "" {
		return nil, errors.New("session cookie value not found")
	}

	userID, sessionID, err := ParseSessionCookieValue(sessionCookieValue)
	if err != nil {
		return nil, errors.Wrap(err, "invalid session cookie format")
	}

	user, err := a.store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	if user.RowStatus == store.Archived {
		return nil, errors.New("user is archived")
	}

	sessions, err := a.store.GetUserSessions(ctx, user.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user sessions")
	}

	if !validateSession(sessionID, sessions) {
		return nil, errors.New("invalid or expired session")
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

// validateSession checks if a session exists and is still valid.
// Uses sliding expiration: session is valid if last accessed within SessionSlidingDuration.
func validateSession(sessionID string, sessions []*storepb.SessionsUserSetting_Session) bool {
	for _, session := range sessions {
		if sessionID == session.SessionId {
			if session.LastAccessedTime != nil {
				expiration := session.LastAccessedTime.AsTime().Add(SessionSlidingDuration)
				if expiration.Before(time.Now()) {
					return false // Session expired
				}
			}
			return true
		}
	}
	return false // Session not found
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
func (a *Authenticator) Authenticate(ctx context.Context, sessionCookie, authHeader string) *AuthResult {
	// Try session cookie authentication first
	if sessionCookie != "" {
		user, err := a.AuthenticateBySession(ctx, sessionCookie)
		if err == nil && user != nil {
			_, sessionID, parseErr := ParseSessionCookieValue(sessionCookie)
			if parseErr == nil && sessionID != "" {
				a.UpdateSessionLastAccessed(ctx, user.ID, sessionID)
			}
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

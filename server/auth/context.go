package auth

import "context"

// ContextKey is the key type for context values.
// Using a custom type prevents collisions with other packages.
type ContextKey int

const (
	// UserIDContextKey stores the authenticated user's ID.
	// Set for both session-based and token-based authentication.
	// Use GetUserID(ctx) to retrieve this value.
	UserIDContextKey ContextKey = iota

	// SessionIDContextKey stores the session ID for session-based auth.
	// Only set when authenticated via session cookie.
	SessionIDContextKey

	// AccessTokenContextKey stores the JWT token for token-based auth.
	// Only set when authenticated via Bearer token.
	AccessTokenContextKey
)

// GetUserID retrieves the authenticated user's ID from the context.
// Returns 0 if no user ID is set (unauthenticated request).
func GetUserID(ctx context.Context) int32 {
	if v, ok := ctx.Value(UserIDContextKey).(int32); ok {
		return v
	}
	return 0
}

// GetSessionID retrieves the session ID from the context.
// Returns empty string if not authenticated via session cookie.
func GetSessionID(ctx context.Context) string {
	if v, ok := ctx.Value(SessionIDContextKey).(string); ok {
		return v
	}
	return ""
}

// GetAccessToken retrieves the JWT access token from the context.
// Returns empty string if not authenticated via bearer token.
func GetAccessToken(ctx context.Context) string {
	if v, ok := ctx.Value(AccessTokenContextKey).(string); ok {
		return v
	}
	return ""
}

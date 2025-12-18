package auth

import (
	"context"

	"github.com/usememos/memos/store"
)

// ContextKey is the key type for context values.
// Using a custom type prevents collisions with other packages.
type ContextKey int

const (
	// UserIDContextKey stores the authenticated user's ID.
	// Set for all authenticated requests.
	// Use GetUserID(ctx) to retrieve this value.
	UserIDContextKey ContextKey = iota

	// AccessTokenContextKey stores the JWT token for token-based auth.
	// Only set when authenticated via Bearer token.
	AccessTokenContextKey

	// UserClaimsContextKey stores the claims from access token.
	UserClaimsContextKey

	// RefreshTokenIDContextKey stores the refresh token ID.
	RefreshTokenIDContextKey
)

// GetUserID retrieves the authenticated user's ID from the context.
// Returns 0 if no user ID is set (unauthenticated request).
func GetUserID(ctx context.Context) int32 {
	if v, ok := ctx.Value(UserIDContextKey).(int32); ok {
		return v
	}
	return 0
}

// GetAccessToken retrieves the JWT access token from the context.
// Returns empty string if not authenticated via bearer token.
func GetAccessToken(ctx context.Context) string {
	if v, ok := ctx.Value(AccessTokenContextKey).(string); ok {
		return v
	}
	return ""
}

// SetUserInContext sets the authenticated user's information in the context.
// This is a simpler alternative to AuthorizeAndSetContext for cases where
// authorization is handled separately (e.g., HTTP middleware).
//
// Parameters:
//   - user: The authenticated user
//   - accessToken: Set if authenticated via JWT token (empty string otherwise)
func SetUserInContext(ctx context.Context, user *store.User, accessToken string) context.Context {
	ctx = context.WithValue(ctx, UserIDContextKey, user.ID)
	if accessToken != "" {
		ctx = context.WithValue(ctx, AccessTokenContextKey, accessToken)
	}
	return ctx
}

// UserClaims represents authenticated user info from access token.
type UserClaims struct {
	UserID   int32
	Username string
	Role     string
	Status   string
}

// GetUserClaims retrieves the user claims from context.
// Returns nil if not authenticated via access token.
func GetUserClaims(ctx context.Context) *UserClaims {
	if v, ok := ctx.Value(UserClaimsContextKey).(*UserClaims); ok {
		return v
	}
	return nil
}

// SetUserClaimsInContext sets the user claims in context.
func SetUserClaimsInContext(ctx context.Context, claims *UserClaims) context.Context {
	return context.WithValue(ctx, UserClaimsContextKey, claims)
}

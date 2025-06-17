package v1

import (
	"context"

	"github.com/usememos/memos/store"
)

// CreateTestUserContext creates a context with username for testing purposes
// This function is only intended for use in tests
func CreateTestUserContext(ctx context.Context, username string) context.Context {
	return context.WithValue(ctx, usernameContextKey, username)
}

// CreateTestUserContextWithUser creates a context and ensures the user exists for testing
// This function is only intended for use in tests
func CreateTestUserContextWithUser(ctx context.Context, s *APIV1Service, user *store.User) context.Context {
	return context.WithValue(ctx, usernameContextKey, user.Username)
}

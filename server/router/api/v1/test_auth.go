package v1

import (
	"context"

	"github.com/usememos/memos/store"
)

// CreateTestUserContext creates a context with user's ID for testing purposes.
// This function is only intended for use in tests.
func CreateTestUserContext(ctx context.Context, userID int32) context.Context {
	return context.WithValue(ctx, userIDContextKey, userID)
}

// CreateTestUserContextWithUser creates a context and ensures the user exists for testing.
// This function is only intended for use in tests.
func CreateTestUserContextWithUser(ctx context.Context, _ *APIV1Service, user *store.User) context.Context {
	return context.WithValue(ctx, userIDContextKey, user.ID)
}

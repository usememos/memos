package auth

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestAuthenticateNoCredentials covers the store-free paths: absent or malformed
// credentials must resolve to "unauthenticated" without touching the store.
// Token-valid paths are exercised by the API/fileserver integration tests.
func TestAuthenticateNoCredentials(t *testing.T) {
	ctx := context.Background()
	a := &Authenticator{secret: "test-secret"} // nil store: these paths never reach it.

	t.Run("Authenticate returns nil without an Authorization header", func(t *testing.T) {
		assert.Nil(t, a.Authenticate(ctx, ""))
	})
	t.Run("Authenticate returns nil for a malformed bearer token", func(t *testing.T) {
		assert.Nil(t, a.Authenticate(ctx, "Bearer not-a-valid-jwt"))
	})

	t.Run("AuthenticateToUser returns nil without any credentials", func(t *testing.T) {
		user, err := a.AuthenticateToUser(ctx, "", "")
		assert.NoError(t, err)
		assert.Nil(t, user)
	})
	t.Run("AuthenticateToUser returns nil for a malformed bearer and no cookie", func(t *testing.T) {
		user, err := a.AuthenticateToUser(ctx, "Bearer not-a-valid-jwt", "")
		assert.NoError(t, err)
		assert.Nil(t, user)
	})
}

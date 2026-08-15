package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/auth"
)

// TestAuthorizerCheckAccess exercises the method-level access policy matrix.
//
// Every case here is decided without touching the store, so a nil store is safe.
func TestAuthorizerCheckAccess(t *testing.T) {
	ctx := context.Background()
	authenticated := &auth.AuthResult{AccessToken: "token"}

	openProfile := &profile.Profile{InstanceURL: "https://memos.example.com"}
	openProfile.SetAllowAnonymous(true)
	privateInstance := &Authorizer{profile: &profile.Profile{InstanceURL: "https://memos.example.com"}}
	openInstance := &Authorizer{profile: openProfile}

	const (
		protectedMethod = "/memos.api.v1.MemoService/CreateMemo"
		publicMethod    = "/memos.api.v1.MemoService/ListMemos"
		bootstrapMethod = "/memos.api.v1.AuthService/SignIn"
		createUser      = "/memos.api.v1.UserService/CreateUser"
		shareMethod     = "/memos.api.v1.MemoService/GetSharedMemo"
	)

	cases := []struct {
		name      string
		az        *Authorizer
		procedure string
		result    *auth.AuthResult
		wantErr   bool
	}{
		{"authenticated reaches protected method", privateInstance, protectedMethod, authenticated, false},
		{"authenticated reaches public method on private instance", privateInstance, publicMethod, authenticated, false},
		{"anonymous denied on protected method", openInstance, protectedMethod, nil, true},
		{"anonymous allowed on public method, open instance", openInstance, publicMethod, nil, false},
		{"anonymous denied on public method, private instance", privateInstance, publicMethod, nil, true},
		// A non-empty InstanceURL alone does not open the instance; only the
		// explicit policy does.
		{"anonymous denied on private instance with URL configured", privateInstance, publicMethod, nil, true},
		{"anonymous allowed on bootstrap method, private instance", privateInstance, bootstrapMethod, nil, false},
		{"anonymous allowed to register on private instance", privateInstance, createUser, nil, false},
		{"anonymous allowed on share access, private instance", privateInstance, shareMethod, nil, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.az.CheckAccess(ctx, c.procedure, c.result)
			if c.wantErr {
				assert.ErrorIs(t, err, ErrUnauthenticated)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestAuthorizerPublicAccessTogglesWithoutRestart verifies that flipping the
// effective policy is honored by the very next CheckAccess call, that a
// configured InstanceURL alone stays private, and that authenticated callers and
// private-instance bootstrap routes are unaffected.
func TestAuthorizerPublicAccessTogglesWithoutRestart(t *testing.T) {
	ctx := context.Background()
	profileInstance := &profile.Profile{InstanceURL: "https://memos.example.com"}
	authorizer := &Authorizer{profile: profileInstance}
	authenticated := &auth.AuthResult{AccessToken: "token"}

	// Default policy is private even with a non-empty InstanceURL.
	assert.ErrorIs(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/ListMemos", nil), ErrUnauthenticated)

	// Enabling public access takes effect immediately.
	profileInstance.SetAllowAnonymous(true)
	assert.NoError(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/ListMemos", nil))

	// Disabling it again closes anonymous access on the next request.
	profileInstance.SetAllowAnonymous(false)
	assert.ErrorIs(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/ListMemos", nil), ErrUnauthenticated)

	// Authenticated callers and bootstrap routes remain valid either way.
	assert.NoError(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/CreateMemo", authenticated))
	assert.NoError(t, authorizer.CheckAccess(ctx, "/memos.api.v1.AuthService/SignIn", nil))
	assert.NoError(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/GetSharedMemo", nil))
}

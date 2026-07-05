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
// The store-backed first-run CreateUser branch is covered by integration tests;
// every case here is decided without touching the store, so a nil store is safe.
func TestAuthorizerCheckAccess(t *testing.T) {
	ctx := context.Background()
	authenticated := &auth.AuthResult{AccessToken: "token"}

	openInstance := &Authorizer{profile: &profile.Profile{InstanceURL: "https://memos.example.com"}}
	privateInstance := &Authorizer{profile: &profile.Profile{InstanceURL: ""}}

	const (
		protectedMethod = "/memos.api.v1.MemoService/CreateMemo"
		publicMethod    = "/memos.api.v1.MemoService/ListMemos"
		bootstrapMethod = "/memos.api.v1.AuthService/SignIn"
		shareMethod     = "/memos.api.v1.MemoService/GetMemoByShare"
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
		{"anonymous allowed on bootstrap method, private instance", privateInstance, bootstrapMethod, nil, false},
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

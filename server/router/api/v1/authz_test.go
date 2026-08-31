package v1

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/usememos/memos/server/auth"
)

type stubAnonymousAccessStore struct {
	allowsAnonymous bool
	err             error
}

func (s stubAnonymousAccessStore) AllowsAnonymousAccess(context.Context) (bool, error) {
	return s.allowsAnonymous, s.err
}

func TestWriteGatewayAuthorizationErrorMapsFailureClass(t *testing.T) {
	unauthenticated := httptest.NewRecorder()
	writeGatewayAuthorizationError(unauthenticated, ErrUnauthenticated)
	assert.Equal(t, http.StatusUnauthorized, unauthenticated.Code)

	internal := httptest.NewRecorder()
	writeGatewayAuthorizationError(internal, errors.New("database unavailable"))
	assert.Equal(t, http.StatusInternalServerError, internal.Code)
	assert.NotContains(t, internal.Body.String(), "database unavailable")
}

// TestAuthorizerCheckAccess exercises the method-level access policy matrix.
func TestAuthorizerCheckAccess(t *testing.T) {
	ctx := context.Background()
	authenticated := &auth.AuthResult{AccessToken: "token"}
	accessStoreError := errors.New("store unavailable")

	publicInstance := &Authorizer{accessStore: stubAnonymousAccessStore{allowsAnonymous: true}}
	privateInstance := &Authorizer{accessStore: stubAnonymousAccessStore{allowsAnonymous: false}}
	unavailableInstance := &Authorizer{accessStore: stubAnonymousAccessStore{err: accessStoreError}}

	const (
		protectedMethod = "/memos.api.v1.MemoService/CreateMemo"
		publicMethod    = "/memos.api.v1.MemoService/ListMemos"
		listReactions   = "/memos.api.v1.MemoService/ListMemoReactions"
		listRelations   = "/memos.api.v1.MemoService/ListMemoRelations"
		bootstrapMethod = "/memos.api.v1.AuthService/SignIn"
		createUser      = "/memos.api.v1.UserService/CreateUser"
		shareMethod     = "/memos.api.v1.MemoService/GetSharedMemo"
	)

	cases := []struct {
		name      string
		az        *Authorizer
		procedure string
		result    *auth.AuthResult
		wantErr   error
	}{
		{"authenticated reaches protected method", privateInstance, protectedMethod, authenticated, nil},
		{"authenticated reaches public method on private instance", privateInstance, publicMethod, authenticated, nil},
		{"anonymous denied on protected method", publicInstance, protectedMethod, nil, ErrUnauthenticated},
		{"anonymous allowed on public method, public instance", publicInstance, publicMethod, nil, nil},
		{"anonymous allowed to list public memo reactions", publicInstance, listReactions, nil, nil},
		{"anonymous allowed to list public memo relations", publicInstance, listRelations, nil, nil},
		{"anonymous denied on public method, private instance", privateInstance, publicMethod, nil, ErrUnauthenticated},
		{"anonymous denied memo reactions on private instance", privateInstance, listReactions, nil, ErrUnauthenticated},
		{"anonymous denied memo relations on private instance", privateInstance, listRelations, nil, ErrUnauthenticated},
		{"anonymous allowed on bootstrap method, private instance", privateInstance, bootstrapMethod, nil, nil},
		{"anonymous allowed to register on private instance", privateInstance, createUser, nil, nil},
		{"anonymous allowed on share access, private instance", privateInstance, shareMethod, nil, nil},
		{"access-store failure is not authentication failure", unavailableInstance, publicMethod, nil, accessStoreError},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.az.CheckAccess(ctx, c.procedure, c.result)
			if c.wantErr != nil {
				assert.ErrorIs(t, err, c.wantErr)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

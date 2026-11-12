package api

import (
	"context"
	"encoding/json"
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
	cases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   int
		wantMsg    string
	}{
		{
			name:       "unauthenticated",
			err:        ErrUnauthenticated,
			wantStatus: http.StatusUnauthorized,
			wantCode:   16,
			wantMsg:    "authentication required",
		},
		{
			name:       "internal authorization failure",
			err:        errors.New("database unavailable"),
			wantStatus: http.StatusInternalServerError,
			wantCode:   13,
			wantMsg:    "failed to resolve API access policy",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			writeGatewayAuthorizationError(response, tc.err)

			assert.Equal(t, tc.wantStatus, response.Code)
			assert.Equal(t, "application/json", response.Header().Get("Content-Type"))

			var body struct {
				Code    int               `json:"code"`
				Message string            `json:"message"`
				Details []json.RawMessage `json:"details"`
			}
			if assert.NoError(t, json.Unmarshal(response.Body.Bytes(), &body)) {
				assert.Equal(t, tc.wantCode, body.Code)
				assert.Equal(t, tc.wantMsg, body.Message)
				assert.NotNil(t, body.Details)
				assert.Empty(t, body.Details)
			}
			assert.NotContains(t, response.Body.String(), "database unavailable")
		})
	}
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
		protectedMethod = "/memos.api.MemoService/CreateMemo"
		publicMethod    = "/memos.api.MemoService/ListMemos"
		listReactions   = "/memos.api.MemoService/ListMemoReactions"
		listRelations   = "/memos.api.MemoService/ListMemoRelations"
		bootstrapMethod = "/memos.api.AuthService/SignIn"
		createUser      = "/memos.api.UserService/CreateUser"
		shareMethod     = "/memos.api.MemoService/GetSharedMemo"
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

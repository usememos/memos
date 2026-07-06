package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
)

// TestAuthorizerPrivateInstanceFirstRun verifies the private-instance access policy
// against a real store: anonymous CreateUser is permitted only until the first user
// exists, bootstrap methods stay open, and other public methods are gated.
func TestAuthorizerPrivateInstanceFirstRun(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// InstanceURL empty => private instance.
	authorizer := apiv1.NewAuthorizer(ts.Store, ts.Secret, &profile.Profile{InstanceURL: ""})

	const (
		createUser   = "/memos.api.v1.UserService/CreateUser"
		signIn       = "/memos.api.v1.AuthService/SignIn"
		listMemos    = "/memos.api.v1.MemoService/ListMemos"
		getMemoShare = "/memos.api.v1.MemoService/GetMemoByShare"
	)

	// Anonymous request with no Authorization header resolves to no identity.
	require.Nil(t, authorizer.Authenticate(ctx, ""))

	// Fresh instance (no users): first-run CreateUser is allowed, and so are the
	// bootstrap methods; browsing is still gated.
	require.NoError(t, authorizer.CheckAccess(ctx, createUser, nil), "first-run CreateUser should be allowed")
	require.NoError(t, authorizer.CheckAccess(ctx, signIn, nil))
	require.NoError(t, authorizer.CheckAccess(ctx, getMemoShare, nil))
	require.ErrorIs(t, authorizer.CheckAccess(ctx, listMemos, nil), apiv1.ErrUnauthenticated)

	// Once a user exists, anonymous CreateUser is denied while bootstrap stays open.
	_, err := ts.CreateHostUser(ctx, "host")
	require.NoError(t, err)
	require.ErrorIs(t, authorizer.CheckAccess(ctx, createUser, nil), apiv1.ErrUnauthenticated, "CreateUser must be denied once a user exists")
	require.NoError(t, authorizer.CheckAccess(ctx, signIn, nil))
}

// TestAuthorizerAccessTokenAlwaysWorksOnPrivateInstance verifies that a valid
// Personal Access Token authenticates through the Authorizer even on a private
// instance, and then passes the access check for an otherwise-gated method.
func TestAuthorizerAccessTokenAlwaysWorksOnPrivateInstance(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "pat-user")
	require.NoError(t, err)

	token := auth.GeneratePersonalAccessToken()
	require.NoError(t, ts.Store.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     util.GenUUID(),
		TokenHash:   auth.HashPersonalAccessToken(token),
		Description: "authz test PAT",
		CreatedAt:   timestamppb.Now(),
	}))

	// InstanceURL empty => private instance; the PAT must still authenticate.
	authorizer := apiv1.NewAuthorizer(ts.Store, ts.Secret, &profile.Profile{InstanceURL: ""})

	result := authorizer.Authenticate(ctx, "Bearer "+token)
	require.NotNil(t, result)
	require.NotNil(t, result.User)
	require.Equal(t, user.ID, result.User.ID)

	// An authenticated caller passes access control even for a gated method.
	require.NoError(t, authorizer.CheckAccess(ctx, "/memos.api.v1.MemoService/ListMemos", result))
}

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

// TestAuthorizerPrivateInstanceRegistration verifies that registration and other
// bootstrap methods stay reachable anonymously while unrelated public methods are
// gated. CreateUser enforces the instance registration settings in the service.
func TestAuthorizerPrivateInstanceRegistration(t *testing.T) {
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

	// Registration and other bootstrap methods are allowed; browsing is still gated.
	require.NoError(t, authorizer.CheckAccess(ctx, createUser, nil))
	require.NoError(t, authorizer.CheckAccess(ctx, signIn, nil))
	require.NoError(t, authorizer.CheckAccess(ctx, getMemoShare, nil))
	require.ErrorIs(t, authorizer.CheckAccess(ctx, listMemos, nil), apiv1.ErrUnauthenticated)

	// Once a user exists, CreateUser remains reachable so UserService can enforce
	// disallow_user_registration and disallow_password_auth.
	_, err := ts.CreateHostUser(ctx, "host")
	require.NoError(t, err)
	require.NoError(t, authorizer.CheckAccess(ctx, createUser, nil))
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

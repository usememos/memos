package test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestCreateLinkedIdentityBindsCurrentUser(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	currentUser, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	mockIDP := newMockOAuthServer(t, "bind-code", "bind-access-token", map[string]any{
		"sub":   "google-sub-1",
		"name":  "Alice Example",
		"email": "alice@example.com",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "google-bind")
	beforeUsers, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)

	authCtx := ts.CreateUserContext(apiv1.WithHeaderCarrier(ctx), currentUser.ID)
	response, err := ts.Service.CreateLinkedIdentity(authCtx, &v1pb.CreateLinkedIdentityRequest{
		Parent:      apiv1.BuildUserName(currentUser.Username),
		IdpName:     idpName,
		Code:        "bind-code",
		RedirectUri: "http://localhost:8080/auth/callback",
	})
	require.NoError(t, err)
	require.NotNil(t, response)
	require.Equal(t, apiv1.BuildUserName(currentUser.Username)+"/linkedIdentities/google-bind", response.Name)
	require.Equal(t, apiv1.IdentityProviderNamePrefix+"google-bind", response.IdpName)
	require.Equal(t, "google-sub-1", response.ExternUid)

	afterUsers, err := ts.Store.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, afterUsers, len(beforeUsers))

	provider := "google-bind"
	externUID := "google-sub-1"
	identity, err := ts.Store.GetUserIdentity(ctx, &store.FindUserIdentity{
		Provider:  &provider,
		ExternUID: &externUID,
	})
	require.NoError(t, err)
	require.NotNil(t, identity)
	require.Equal(t, currentUser.ID, identity.UserID)
}

func TestCreateLinkedIdentityRejectsBindingIdentityLinkedToAnotherUser(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	owner, err := ts.CreateRegularUser(ctx, "owner")
	require.NoError(t, err)
	binder, err := ts.CreateRegularUser(ctx, "binder")
	require.NoError(t, err)

	mockIDP := newMockOAuthServer(t, "conflict-code", "conflict-access-token", map[string]any{
		"sub":   "google-sub-2",
		"name":  "Conflict Example",
		"email": "conflict@example.com",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "google-conflict")
	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    owner.ID,
		Provider:  "google-conflict",
		ExternUID: "google-sub-2",
	})
	require.NoError(t, err)

	authCtx := ts.CreateUserContext(apiv1.WithHeaderCarrier(ctx), binder.ID)
	_, err = ts.Service.CreateLinkedIdentity(authCtx, &v1pb.CreateLinkedIdentityRequest{
		Parent:      apiv1.BuildUserName(binder.Username),
		IdpName:     idpName,
		Code:        "conflict-code",
		RedirectUri: "http://localhost:8080/auth/callback",
	})
	require.Error(t, err)
	require.Equal(t, codes.AlreadyExists, status.Code(err))
}

func TestListAndDeleteLinkedIdentities(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	currentUser, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    currentUser.ID,
		Provider:  "google",
		ExternUID: "alice@gmail.com",
	})
	require.NoError(t, err)

	authCtx := ts.CreateUserContext(ctx, currentUser.ID)
	listResp, err := ts.Service.ListLinkedIdentities(authCtx, &v1pb.ListLinkedIdentitiesRequest{
		Parent: apiv1.BuildUserName(currentUser.Username),
	})
	require.NoError(t, err)
	require.Len(t, listResp.LinkedIdentities, 1)
	linkedIdentityName := apiv1.BuildUserName(currentUser.Username) + "/linkedIdentities/google"
	require.Equal(t, linkedIdentityName, listResp.LinkedIdentities[0].Name)
	require.Equal(t, apiv1.IdentityProviderNamePrefix+"google", listResp.LinkedIdentities[0].IdpName)
	require.Equal(t, "alice@gmail.com", listResp.LinkedIdentities[0].ExternUid)

	got, err := ts.Service.GetLinkedIdentity(authCtx, &v1pb.GetLinkedIdentityRequest{
		Name: linkedIdentityName,
	})
	require.NoError(t, err)
	require.Equal(t, linkedIdentityName, got.Name)
	require.Equal(t, apiv1.IdentityProviderNamePrefix+"google", got.IdpName)
	require.Equal(t, "alice@gmail.com", got.ExternUid)

	_, err = ts.Service.DeleteLinkedIdentity(authCtx, &v1pb.DeleteLinkedIdentityRequest{
		Name: linkedIdentityName,
	})
	require.NoError(t, err)

	listResp, err = ts.Service.ListLinkedIdentities(authCtx, &v1pb.ListLinkedIdentitiesRequest{
		Parent: apiv1.BuildUserName(currentUser.Username),
	})
	require.NoError(t, err)
	require.Empty(t, listResp.LinkedIdentities)
}

func TestListLinkedIdentitiesRequiresAuthentication(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "linked-identity-auth")
	require.NoError(t, err)

	_, err = ts.Service.ListLinkedIdentities(ctx, &v1pb.ListLinkedIdentitiesRequest{
		Parent: apiv1.BuildUserName(user.Username),
	})
	require.Error(t, err)
	require.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestCreateLinkedIdentityRejectsSecondIdentityForSameProvider(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	currentUser, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	_, err = ts.Store.CreateUserIdentity(ctx, &store.UserIdentity{
		UserID:    currentUser.ID,
		Provider:  "google-provider",
		ExternUID: "google-sub-1",
	})
	require.NoError(t, err)

	mockIDP := newMockOAuthServer(t, "second-code", "second-access-token", map[string]any{
		"sub":   "google-sub-2",
		"name":  "Alice Example",
		"email": "alice@example.com",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "google-provider")
	authCtx := ts.CreateUserContext(apiv1.WithHeaderCarrier(ctx), currentUser.ID)

	_, err = ts.Service.CreateLinkedIdentity(authCtx, &v1pb.CreateLinkedIdentityRequest{
		Parent:      apiv1.BuildUserName(currentUser.Username),
		IdpName:     idpName,
		Code:        "second-code",
		RedirectUri: "http://localhost:8080/auth/callback",
	})
	require.Error(t, err)
	require.Equal(t, codes.AlreadyExists, status.Code(err))
}

func createTestingOAuthIdentityProvider(ctx context.Context, t *testing.T, ts *TestService, serverURL, uid string) string {
	t.Helper()

	idp, err := ts.Store.CreateIdentityProvider(ctx, &storepb.IdentityProvider{
		Uid:  uid,
		Name: "Google",
		Type: storepb.IdentityProvider_OAUTH2,
		Config: &storepb.IdentityProviderConfig{
			Config: &storepb.IdentityProviderConfig_Oauth2Config{
				Oauth2Config: &storepb.OAuth2Config{
					ClientId:     "test-client-id",
					ClientSecret: "test-client-secret",
					AuthUrl:      serverURL + "/oauth2/authorize",
					TokenUrl:     serverURL + "/oauth2/token",
					UserInfoUrl:  serverURL + "/oauth2/userinfo",
					FieldMapping: &storepb.FieldMapping{
						Identifier:  "sub",
						DisplayName: "name",
						Email:       "email",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	return apiv1.IdentityProviderNamePrefix + idp.Uid
}

func newMockOAuthServer(t *testing.T, code, accessToken string, userInfo map[string]any) *httptest.Server {
	t.Helper()

	userInfoBytes, err := json.Marshal(userInfo)
	require.NoError(t, err)

	mux := http.NewServeMux()
	mux.HandleFunc("/oauth2/token", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		values, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		require.Equal(t, code, values.Get("code"))
		require.Equal(t, "authorization_code", values.Get("grant_type"))

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]any{
			"access_token": accessToken,
			"token_type":   "Bearer",
			"expires_in":   3600,
		})
		require.NoError(t, err)
	})
	mux.HandleFunc("/oauth2/userinfo", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write(userInfoBytes)
		require.NoError(t, err)
	})

	return httptest.NewServer(mux)
}

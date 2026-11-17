package test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/server/api"
)

const testingSSOCallbackURI = "http://localhost:8080/auth/callback"

func issueTestingSSOState(ctx context.Context, t *testing.T, ts *TestService, idpName string, pkceRequired bool) string {
	t.Helper()
	resp, err := ts.Service.CreateSSOAuthorizationState(ctx, &apipb.CreateSSOAuthorizationStateRequest{
		IdentityProvider: idpName,
		RedirectUri:      testingSSOCallbackURI,
		PkceRequired:     pkceRequired,
	})
	require.NoError(t, err)
	return resp.GetState()
}

// tokenExchange records what the Memos server actually sent to the provider.
type tokenExchange struct {
	code         string
	redirectURI  string
	codeVerifier string
}

// newRecordingMockOAuthServer accepts any single authorization code and records
// the token request, so tests can assert which values Memos passed through.
func newRecordingMockOAuthServer(t *testing.T, accessToken string, userInfo map[string]any) (*httptest.Server, *tokenExchange) {
	t.Helper()

	userInfoBytes, err := json.Marshal(userInfo)
	require.NoError(t, err)

	recorded := &tokenExchange{}
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth2/token", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		values, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		recorded.code = values.Get("code")
		recorded.redirectURI = values.Get("redirect_uri")
		recorded.codeVerifier = values.Get("code_verifier")

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

	return httptest.NewServer(mux), recorded
}

func signInWithSSORequest(ctx context.Context, ts *TestService, idpName, code, redirectURI, codeVerifier, state string) (*apipb.SignInResponse, error) {
	return ts.Service.SignIn(api.WithHeaderCarrier(ctx), &apipb.SignInRequest{
		Credentials: &apipb.SignInRequest_SsoCredentials_{
			SsoCredentials: &apipb.SignInRequest_SsoCredentials{
				IdentityProvider: idpName,
				Code:             code,
				RedirectUri:      redirectURI,
				CodeVerifier:     codeVerifier,
				State:            state,
			},
		},
	})
}

func TestSSOSignInWithoutStateNeverReachesTheProvider(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP, recorded := newRecordingMockOAuthServer(t, "stateless-token", map[string]any{
		"sub":  "stateless-sub",
		"name": "Stateless User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "stateless-idp")
	_, err := signInWithSSORequest(ctx, ts, idpName, "any-code", "http://evil.example/steal", "", "")
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, recorded.code, "the provider must not be contacted without a server-issued state")
}

func TestSSOSignInUsesRecordedRedirectURI(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP, recorded := newRecordingMockOAuthServer(t, "pinned-token", map[string]any{
		"sub":  "pinned-sub",
		"name": "Pinned User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "pinned-idp")
	state := issueTestingSSOState(ctx, t, ts, idpName, false)

	// The caller names a different redirect URI than the one recorded at flow
	// start; the exchange must use the recorded one.
	response, err := signInWithSSORequest(ctx, ts, idpName, "stolen-code", "http://evil.example/steal", "", state)
	require.NoError(t, err)
	require.Equal(t, "pinned-sub", response.User.Username)
	require.Equal(t, "stolen-code", recorded.code)
	require.Equal(t, testingSSOCallbackURI, recorded.redirectURI)
}

func TestSSOStateIsSingleUse(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP, _ := newRecordingMockOAuthServer(t, "replay-token", map[string]any{
		"sub":  "replay-sub",
		"name": "Replay User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "replay-idp")
	state := issueTestingSSOState(ctx, t, ts, idpName, false)

	_, err := signInWithSSORequest(ctx, ts, idpName, "replay-code", testingSSOCallbackURI, "", state)
	require.NoError(t, err)

	_, err = signInWithSSORequest(ctx, ts, idpName, "replay-code", testingSSOCallbackURI, "", state)
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestSSOStateIsBoundToIdentityProvider(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP, recorded := newRecordingMockOAuthServer(t, "cross-token", map[string]any{
		"sub":  "cross-sub",
		"name": "Cross User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "cross-idp-a")
	otherIDPName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "cross-idp-b")
	state := issueTestingSSOState(ctx, t, ts, idpName, false)

	_, err := signInWithSSORequest(ctx, ts, otherIDPName, "cross-code", testingSSOCallbackURI, "", state)
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, recorded.code, "a state issued for one provider must not redeem a code at another")
}

func TestSSOStateWithPKCERequiresVerifier(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP, recorded := newRecordingMockOAuthServer(t, "pkce-token", map[string]any{
		"sub":  "pkce-sub",
		"name": "PKCE User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "pkce-idp")

	missingVerifierState := issueTestingSSOState(ctx, t, ts, idpName, true)
	_, err := signInWithSSORequest(ctx, ts, idpName, "pkce-code", testingSSOCallbackURI, "", missingVerifierState)
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, recorded.code, "a PKCE flow without a verifier must not reach the provider")

	withVerifierState := issueTestingSSOState(ctx, t, ts, idpName, true)
	_, err = signInWithSSORequest(ctx, ts, idpName, "pkce-code", testingSSOCallbackURI, "the-verifier", withVerifierState)
	require.NoError(t, err)
	require.Equal(t, "the-verifier", recorded.codeVerifier)
}

func TestCreateLinkedIdentityRequiresState(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	currentUser, err := ts.CreateRegularUser(ctx, "linkee")
	require.NoError(t, err)

	mockIDP, recorded := newRecordingMockOAuthServer(t, "link-token", map[string]any{
		"sub":  "link-sub",
		"name": "Link User",
	})
	defer mockIDP.Close()

	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "link-idp")
	authCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), currentUser.ID)

	_, err = ts.Service.CreateLinkedIdentity(authCtx, &apipb.CreateLinkedIdentityRequest{
		Parent:           api.BuildUserName(currentUser.Username),
		IdentityProvider: idpName,
		Code:             "link-code",
		RedirectUri:      "http://evil.example/steal",
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, recorded.code)

	state := issueTestingSSOState(ctx, t, ts, idpName, false)
	linked, err := ts.Service.CreateLinkedIdentity(authCtx, &apipb.CreateLinkedIdentityRequest{
		Parent:           api.BuildUserName(currentUser.Username),
		IdentityProvider: idpName,
		Code:             "link-code",
		RedirectUri:      "http://evil.example/steal",
		State:            state,
	})
	require.NoError(t, err)
	require.Equal(t, "link-sub", linked.ExternalUid)
	require.Equal(t, testingSSOCallbackURI, recorded.redirectURI)
}

func TestCreateSSOAuthorizationStateValidatesRequest(t *testing.T) {
	t.Parallel()

	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	mockIDP := newMockOAuthServer(t, "validation-code", "validation-token", map[string]any{
		"sub": "validation-sub",
	})
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "validation-idp")

	// Unknown provider.
	_, err := ts.Service.CreateSSOAuthorizationState(ctx, &apipb.CreateSSOAuthorizationStateRequest{
		IdentityProvider: api.IdentityProviderNamePrefix + "missing",
		RedirectUri:      testingSSOCallbackURI,
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// Relative redirect URI.
	_, err = ts.Service.CreateSSOAuthorizationState(ctx, &apipb.CreateSSOAuthorizationStateRequest{
		IdentityProvider: idpName,
		RedirectUri:      "/auth/callback",
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	// Non-http(s) redirect URI.
	_, err = ts.Service.CreateSSOAuthorizationState(ctx, &apipb.CreateSSOAuthorizationStateRequest{
		IdentityProvider: idpName,
		RedirectUri:      "javascript:alert(1)",
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	resp, err := ts.Service.CreateSSOAuthorizationState(ctx, &apipb.CreateSSOAuthorizationStateRequest{
		IdentityProvider: idpName,
		RedirectUri:      testingSSOCallbackURI,
	})
	require.NoError(t, err)
	require.NotEmpty(t, resp.State)
	require.True(t, resp.ExpireTime.AsTime().After(time.Now()), "state expiry must be in the future")
}

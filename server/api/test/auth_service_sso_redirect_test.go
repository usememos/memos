package test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/server/api"
)

func TestSSOSignInRejectsRedirectURIOutsideInstanceCallback(t *testing.T) {
	tests := []struct {
		name        string
		redirectURI string
	}{
		{name: "foreign origin", redirectURI: "http://evil.example/steal"},
		{name: "foreign origin with the callback path", redirectURI: "http://evil.example/auth/callback"},
		{name: "other scheme", redirectURI: "https://localhost:8080/auth/callback"},
		{name: "other port", redirectURI: "http://localhost:8081/auth/callback"},
		{name: "other path", redirectURI: "http://localhost:8080/auth"},
		{name: "escaped path", redirectURI: "http://localhost:8080/auth%2Fcallback"},
		{name: "query", redirectURI: "http://localhost:8080/auth/callback?next=evil"},
		{name: "fragment", redirectURI: "http://localhost:8080/auth/callback#evil"},
		{name: "user info", redirectURI: "http://evil@localhost:8080/auth/callback"},
		{name: "relative", redirectURI: "/auth/callback"},
		{name: "empty", redirectURI: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()

			ctx := context.Background()
			mockIDP := newRecordingOAuthServer(t, "redirect-sub")
			defer mockIDP.Close()
			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "redirect-reject")

			_, err := signInWithTestingSSORedirect(ctx, ts, idpName, test.redirectURI)
			require.Error(t, err)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.Contains(t, status.Convert(err).Message(), "http://localhost:8080/auth/callback")
			// The code must not reach the provider with a redirect URI the caller chose.
			require.Empty(t, mockIDP.exchangedRedirectURIs())
		})
	}
}

func TestSSOSignInExchangesWithInstanceCallback(t *testing.T) {
	tests := []struct {
		name        string
		instanceURL string
		redirectURI string
	}{
		{name: "exact", instanceURL: "http://localhost:8080", redirectURI: "http://localhost:8080/auth/callback"},
		{name: "host case", instanceURL: "http://localhost:8080", redirectURI: "http://LOCALHOST:8080/auth/callback"},
		{name: "default port", instanceURL: "https://memos.example", redirectURI: "https://memos.example:443/auth/callback"},
		{name: "instance URL with a trailing slash", instanceURL: "http://localhost:8080/", redirectURI: "http://localhost:8080/auth/callback"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()
			ts.Profile.InstanceURL = test.instanceURL

			ctx := context.Background()
			mockIDP := newRecordingOAuthServer(t, "redirect-sub")
			defer mockIDP.Close()
			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "redirect-accept")

			_, err := signInWithTestingSSORedirect(ctx, ts, idpName, test.redirectURI)
			require.NoError(t, err)
			// The provider compares strings, so it gets the URI the browser used.
			require.Equal(t, []string{test.redirectURI}, mockIDP.exchangedRedirectURIs())
		})
	}
}

func TestSSOSignInPassesRedirectURIThroughWithoutInstanceURL(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ts.Profile.InstanceURL = ""

	ctx := context.Background()
	mockIDP := newRecordingOAuthServer(t, "redirect-sub")
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "redirect-unpinned")

	_, err := signInWithTestingSSORedirect(ctx, ts, idpName, "http://192.168.1.10:5230/auth/callback")
	require.NoError(t, err)
	require.Equal(t, []string{"http://192.168.1.10:5230/auth/callback"}, mockIDP.exchangedRedirectURIs())
}

// An instance URL that names no origin cannot pin the callback, so sign-in is
// refused rather than passed through as if no instance URL were configured.
func TestSSOSignInFailsClosedOnInstanceURLWithoutOrigin(t *testing.T) {
	for _, instanceURL := range []string{"localhost:8080", "memos.example", "/memos", "https://"} {
		t.Run(instanceURL, func(t *testing.T) {
			ts := NewTestService(t)
			defer ts.Cleanup()
			ts.Profile.InstanceURL = instanceURL

			ctx := context.Background()
			mockIDP := newRecordingOAuthServer(t, "redirect-sub")
			defer mockIDP.Close()
			idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "redirect-no-origin")

			_, err := signInWithTestingSSORedirect(ctx, ts, idpName, "http://localhost:8080/auth/callback")
			require.Equal(t, codes.Internal, status.Code(err))
			require.Empty(t, mockIDP.exchangedRedirectURIs())
		})
	}
}

func TestCreateLinkedIdentityRejectsRedirectURIOutsideInstanceCallback(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()

	ctx := context.Background()
	currentUser, err := ts.CreateRegularUser(ctx, "alice")
	require.NoError(t, err)

	mockIDP := newRecordingOAuthServer(t, "redirect-sub")
	defer mockIDP.Close()
	idpName := createTestingOAuthIdentityProvider(ctx, t, ts, mockIDP.URL, "redirect-link")

	authCtx := ts.CreateUserContext(api.WithHeaderCarrier(ctx), currentUser.ID)
	_, err = ts.Service.CreateLinkedIdentity(authCtx, &apipb.CreateLinkedIdentityRequest{
		Parent:           api.BuildUserName(currentUser.Username),
		IdentityProvider: idpName,
		Code:             "redirect-code",
		RedirectUri:      "http://evil.example/steal",
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Empty(t, mockIDP.exchangedRedirectURIs())
}

func signInWithTestingSSORedirect(ctx context.Context, ts *TestService, idpName, redirectURI string) (*apipb.SignInResponse, error) {
	return ts.Service.SignIn(api.WithHeaderCarrier(ctx), &apipb.SignInRequest{
		Credentials: &apipb.SignInRequest_SsoCredentials_{
			SsoCredentials: &apipb.SignInRequest_SsoCredentials{
				IdentityProvider: idpName,
				Code:             "redirect-code",
				RedirectUri:      redirectURI,
			},
		},
	})
}

// recordingOAuthServer is an identity provider that accepts every code and
// records the redirect URI named in each token exchange.
type recordingOAuthServer struct {
	*httptest.Server

	mu           sync.Mutex
	redirectURIs []string
}

func newRecordingOAuthServer(t *testing.T, subject string) *recordingOAuthServer {
	t.Helper()

	server := &recordingOAuthServer{}
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth2/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		server.mu.Lock()
		server.redirectURIs = append(server.redirectURIs, r.PostForm.Get("redirect_uri"))
		server.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "redirect-access-token",
			"token_type":   "Bearer",
			"expires_in":   3600,
		})
	})
	mux.HandleFunc("/oauth2/userinfo", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"sub": subject})
	})
	server.Server = httptest.NewServer(mux)
	return server
}

func (s *recordingOAuthServer) exchangedRedirectURIs() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.redirectURIs)
}

package oauth2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/idp"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestNewIdentityProvider(t *testing.T) {
	tests := []struct {
		name        string
		config      *storepb.OAuth2Config
		containsErr string
	}{
		{
			name: "no tokenUrl",
			config: &storepb.OAuth2Config{
				ClientId:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthUrl:      "",
				TokenUrl:     "",
				UserInfoUrl:  "https://example.com/api/user",
				FieldMapping: &storepb.FieldMapping{
					Identifier: "login",
				},
			},
			containsErr: `the field "tokenUrl" is empty but required`,
		},
		{
			name: "no userInfoUrl",
			config: &storepb.OAuth2Config{
				ClientId:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthUrl:      "",
				TokenUrl:     "https://example.com/token",
				UserInfoUrl:  "",
				FieldMapping: &storepb.FieldMapping{
					Identifier: "login",
				},
			},
			containsErr: `the field "userInfoUrl" is empty but required`,
		},
		{
			name: "no field mapping identifier",
			config: &storepb.OAuth2Config{
				ClientId:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthUrl:      "",
				TokenUrl:     "https://example.com/token",
				UserInfoUrl:  "https://example.com/api/user",
				FieldMapping: &storepb.FieldMapping{
					Identifier: "",
				},
			},
			containsErr: `the field "fieldMapping.identifier" is empty but required`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(*testing.T) {
			_, err := NewIdentityProvider(test.config)
			assert.ErrorContains(t, err, test.containsErr)
		})
	}
}

func newMockServer(t *testing.T, code, accessToken string, userinfo []byte) *httptest.Server {
	mux := http.NewServeMux()

	var rawIDToken string
	mux.HandleFunc("/oauth2/token", func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		vals, err := url.ParseQuery(string(body))
		require.NoError(t, err)

		require.Equal(t, code, vals.Get("code"))
		require.Equal(t, "authorization_code", vals.Get("grant_type"))

		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(map[string]any{
			"access_token": accessToken,
			"token_type":   "Bearer",
			"expires_in":   3600,
			"id_token":     rawIDToken,
		})
		require.NoError(t, err)
	})
	mux.HandleFunc("/oauth2/userinfo", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write(userinfo)
		require.NoError(t, err)
	})

	s := httptest.NewServer(mux)

	return s
}

func TestIdentityProvider(t *testing.T) {
	ctx := context.Background()

	const (
		testClientID    = "test-client-id"
		testCode        = "test-code"
		testAccessToken = "test-access-token"
		testSubject     = "123456789"
		testName        = "John Doe"
		testEmail       = "john.doe@example.com"
	)
	userInfo, err := json.Marshal(
		map[string]any{
			"sub":   testSubject,
			"name":  testName,
			"email": testEmail,
		},
	)
	require.NoError(t, err)

	s := newMockServer(t, testCode, testAccessToken, userInfo)

	oauth2, err := NewIdentityProvider(
		&storepb.OAuth2Config{
			ClientId:     testClientID,
			ClientSecret: "test-client-secret",
			TokenUrl:     fmt.Sprintf("%s/oauth2/token", s.URL),
			UserInfoUrl:  fmt.Sprintf("%s/oauth2/userinfo", s.URL),
			FieldMapping: &storepb.FieldMapping{
				Identifier:  "sub",
				DisplayName: "name",
				Email:       "email",
			},
		},
	)
	require.NoError(t, err)

	redirectURL := "https://example.com/oauth/callback"
	// Test without PKCE (backward compatibility)
	oauthToken, err := oauth2.ExchangeToken(ctx, redirectURL, testCode, "")
	require.NoError(t, err)
	require.Equal(t, testAccessToken, oauthToken)

	userInfoResult, err := oauth2.UserInfo(ctx, oauthToken)
	require.NoError(t, err)

	wantUserInfo := &idp.IdentityProviderUserInfo{
		Identifier:  testSubject,
		DisplayName: testName,
		Email:       testEmail,
	}
	assert.Equal(t, wantUserInfo, userInfoResult)
}

func TestIdentityProviderExchangeTokenClientAuthentication(t *testing.T) {
	const (
		clientID     = "test-client-id"
		clientSecret = "test-client-secret"
		code         = "test-code"
		accessToken  = "test-access-token"
		codeVerifier = "test-code-verifier"
	)

	tests := []struct {
		name             string
		acceptBasicAuth  bool
		expectedRequests int
	}{
		{
			name:             "client secret basic",
			acceptBasicAuth:  true,
			expectedRequests: 1,
		},
		{
			name:             "client secret post fallback",
			acceptBasicAuth:  false,
			expectedRequests: 2,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestCount := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestCount++
				require.NoError(t, r.ParseForm())
				require.Equal(t, code, r.Form.Get("code"))
				require.Equal(t, codeVerifier, r.Form.Get("code_verifier"))

				username, password, hasBasicAuth := r.BasicAuth()
				if test.acceptBasicAuth {
					require.True(t, hasBasicAuth)
					require.Equal(t, clientID, username)
					require.Equal(t, clientSecret, password)
					require.Empty(t, r.Form.Get("client_id"))
					require.Empty(t, r.Form.Get("client_secret"))
				} else if hasBasicAuth {
					http.Error(w, `{"error":"invalid_client"}`, http.StatusUnauthorized)
					return
				} else {
					require.Equal(t, clientID, r.Form.Get("client_id"))
					require.Equal(t, clientSecret, r.Form.Get("client_secret"))
				}

				w.Header().Set("Content-Type", "application/json")
				require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
					"access_token": accessToken,
					"token_type":   "Bearer",
				}))
			}))
			defer server.Close()

			provider, err := NewIdentityProvider(&storepb.OAuth2Config{
				ClientId:     clientID,
				ClientSecret: clientSecret,
				TokenUrl:     server.URL,
				UserInfoUrl:  "https://example.com/oauth2/userinfo",
				FieldMapping: &storepb.FieldMapping{Identifier: "sub"},
			})
			require.NoError(t, err)

			token, err := provider.ExchangeToken(context.Background(), "https://example.com/auth/callback", code, codeVerifier)
			require.NoError(t, err)
			assert.Equal(t, accessToken, token)
			assert.Equal(t, test.expectedRequests, requestCount)
		})
	}
}

func TestIdentityProviderUserInfoUsesContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer s.Close()

	oauth2, err := NewIdentityProvider(
		&storepb.OAuth2Config{
			ClientId:     "test-client-id",
			ClientSecret: "test-client-secret",
			TokenUrl:     "https://example.com/oauth2/token",
			UserInfoUrl:  s.URL,
			FieldMapping: &storepb.FieldMapping{
				Identifier: "sub",
			},
		},
	)
	require.NoError(t, err)

	_, err = oauth2.UserInfo(ctx, "test-access-token")
	require.Error(t, err)
	assert.ErrorContains(t, err, "failed to get user information")
}

func TestIdentityProviderUserInfoRejectsNon2xx(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "upstream failure", http.StatusBadGateway)
	}))
	defer s.Close()

	oauth2, err := NewIdentityProvider(
		&storepb.OAuth2Config{
			ClientId:     "test-client-id",
			ClientSecret: "test-client-secret",
			TokenUrl:     "https://example.com/oauth2/token",
			UserInfoUrl:  s.URL,
			FieldMapping: &storepb.FieldMapping{
				Identifier: "sub",
			},
		},
	)
	require.NoError(t, err)

	_, err = oauth2.UserInfo(context.Background(), "test-access-token")
	require.Error(t, err)
	assert.ErrorContains(t, err, "userinfo request failed with status 502")
	assert.ErrorContains(t, err, "upstream failure")
}

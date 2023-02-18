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
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/store"
)

func TestNewIdentityProvider(t *testing.T) {
	tests := []struct {
		name        string
		config      *store.IdentityProviderOAuth2Config
		containsErr string
	}{
		{
			name: "no tokenUrl",
			config: &store.IdentityProviderOAuth2Config{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthURL:      "",
				TokenURL:     "",
				UserInfoURL:  "https://example.com/api/user",
				FieldMapping: &store.FieldMapping{
					Identifier: "login",
				},
			},
			containsErr: `the field "tokenUrl" is empty but required`,
		},
		{
			name: "no userInfoUrl",
			config: &store.IdentityProviderOAuth2Config{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthURL:      "",
				TokenURL:     "https://example.com/token",
				UserInfoURL:  "",
				FieldMapping: &store.FieldMapping{
					Identifier: "login",
				},
			},
			containsErr: `the field "userInfoUrl" is empty but required`,
		},
		{
			name: "no field mapping identifier",
			config: &store.IdentityProviderOAuth2Config{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				AuthURL:      "",
				TokenURL:     "https://example.com/token",
				UserInfoURL:  "https://example.com/api/user",
				FieldMapping: &store.FieldMapping{
					Identifier: "",
				},
			},
			containsErr: `the field "fieldMapping.identifier" is empty but required`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
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
			"access_token":  accessToken,
			"token_type":    "Bearer",
			"refresh_token": "test-refresh-token",
			"expires_in":    3600,
			"id_token":      rawIDToken,
		})
		require.NoError(t, err)
	})
	mux.HandleFunc("/oauth2/userinfo", func(w http.ResponseWriter, r *http.Request) {
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
		&store.IdentityProviderOAuth2Config{
			ClientID:     testClientID,
			ClientSecret: "test-client-secret",
			TokenURL:     fmt.Sprintf("%s/oauth2/token", s.URL),
			UserInfoURL:  fmt.Sprintf("%s/oauth2/userinfo", s.URL),
			FieldMapping: &store.FieldMapping{
				Identifier:  "sub",
				DisplayName: "name",
				Email:       "email",
			},
		},
	)
	require.NoError(t, err)

	redirectURL := "https://example.com/oauth/callback"
	oauthToken, err := oauth2.ExchangeToken(ctx, redirectURL, testCode)
	require.NoError(t, err)
	require.Equal(t, testAccessToken, oauthToken)

	userInfoResult, err := oauth2.UserInfo(oauthToken)
	require.NoError(t, err)

	wantUserInfo := &idp.IdentityProviderUserInfo{
		Identifier:  testSubject,
		DisplayName: testName,
		Email:       testEmail,
	}
	assert.Equal(t, wantUserInfo, userInfoResult)
}

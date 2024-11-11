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

// Package oauth2 is the plugin for OAuth2 Identity Provider.
package oauth2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/pkg/errors"
	"golang.org/x/oauth2"

	"github.com/usememos/memos/plugin/idp"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// IdentityProvider represents an OAuth2 Identity Provider.
type IdentityProvider struct {
	config *storepb.OAuth2Config
}

// NewIdentityProvider initializes a new OAuth2 Identity Provider with the given configuration.
func NewIdentityProvider(config *storepb.OAuth2Config) (*IdentityProvider, error) {
	for v, field := range map[string]string{
		config.ClientId:                "clientId",
		config.ClientSecret:            "clientSecret",
		config.TokenUrl:                "tokenUrl",
		config.UserInfoUrl:             "userInfoUrl",
		config.FieldMapping.Identifier: "fieldMapping.identifier",
	} {
		if v == "" {
			return nil, errors.Errorf(`the field "%s" is empty but required`, field)
		}
	}

	return &IdentityProvider{
		config: config,
	}, nil
}

// ExchangeToken returns the exchanged OAuth2 token using the given authorization code.
// If codeVerifier is provided, it will be used for PKCE (Proof Key for Code Exchange) validation.
func (p *IdentityProvider) ExchangeToken(ctx context.Context, redirectURL, code, codeVerifier string) (string, error) {
	conf := &oauth2.Config{
		ClientID:     p.config.ClientId,
		ClientSecret: p.config.ClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       p.config.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:   p.config.AuthUrl,
			TokenURL:  p.config.TokenUrl,
			AuthStyle: oauth2.AuthStyleInParams,
		},
	}

	// Prepare token exchange options
	opts := []oauth2.AuthCodeOption{}

	// Add PKCE code_verifier if provided
	if codeVerifier != "" {
		opts = append(opts, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	}

	token, err := conf.Exchange(ctx, code, opts...)
	if err != nil {
		return "", errors.Wrap(err, "failed to exchange access token")
	}

	// Use the standard AccessToken field instead of Extra()
	// This is more reliable across different OAuth providers
	if token.AccessToken == "" {
		return "", errors.New("missing access token from authorization response")
	}

	return token.AccessToken, nil
}

// UserInfo returns the parsed user information using the given OAuth2 token.
func (p *IdentityProvider) UserInfo(token string) (*idp.IdentityProviderUserInfo, error) {
	client := &http.Client{}
	req, err := http.NewRequest(http.MethodGet, p.config.UserInfoUrl, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to new http request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user information")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read response body")
	}

	var claims map[string]any
	if err := json.Unmarshal(body, &claims); err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}
	slog.Info("user info claims", "claims", claims)
	userInfo := &idp.IdentityProviderUserInfo{}
	if v, ok := claims[p.config.FieldMapping.Identifier].(string); ok {
		userInfo.Identifier = v
	}
	if userInfo.Identifier == "" {
		return nil, errors.Errorf("the field %q is not found in claims or has empty value", p.config.FieldMapping.Identifier)
	}

	// Best effort to map optional fields
	if p.config.FieldMapping.DisplayName != "" {
		if v, ok := claims[p.config.FieldMapping.DisplayName].(string); ok {
			userInfo.DisplayName = v
		}
	}
	if userInfo.DisplayName == "" {
		userInfo.DisplayName = userInfo.Identifier
	}
	if p.config.FieldMapping.Email != "" {
		if v, ok := claims[p.config.FieldMapping.Email].(string); ok {
			userInfo.Email = v
		}
	}
	if p.config.FieldMapping.AvatarUrl != "" {
		if v, ok := claims[p.config.FieldMapping.AvatarUrl].(string); ok {
			userInfo.AvatarURL = v
		}
	}
	slog.Info("user info", "userInfo", userInfo)
	return userInfo, nil
}

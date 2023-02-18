// Package oauth2 is the plugin for OAuth2 Identity Provider.
package oauth2

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/pkg/errors"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/store"
	"golang.org/x/oauth2"
)

// IdentityProvider represents an OAuth2 Identity Provider.
type IdentityProvider struct {
	config *store.IdentityProviderOAuth2Config
}

// NewIdentityProvider initializes a new OAuth2 Identity Provider with the given configuration.
func NewIdentityProvider(config *store.IdentityProviderOAuth2Config) (*IdentityProvider, error) {
	for v, field := range map[string]string{
		config.ClientID:                "clientId",
		config.ClientSecret:            "clientSecret",
		config.TokenURL:                "tokenUrl",
		config.UserInfoURL:             "userInfoUrl",
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
func (p *IdentityProvider) ExchangeToken(ctx context.Context, redirectURL, code string) (string, error) {
	conf := &oauth2.Config{
		ClientID:     p.config.ClientID,
		ClientSecret: p.config.ClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       p.config.Scopes,
		Endpoint: oauth2.Endpoint{
			AuthURL:   p.config.AuthURL,
			TokenURL:  p.config.TokenURL,
			AuthStyle: oauth2.AuthStyleInParams,
		},
	}

	token, err := conf.Exchange(ctx, code)
	if err != nil {
		return "", errors.Wrap(err, "failed to exchange access token")
	}

	accessToken, ok := token.Extra("access_token").(string)
	if !ok {
		return "", errors.New(`missing "access_token" from authorization response`)
	}

	return accessToken, nil
}

// UserInfo returns the parsed user information using the given OAuth2 token.
func (p *IdentityProvider) UserInfo(token string) (*idp.IdentityProviderUserInfo, error) {
	client := &http.Client{}
	req, err := http.NewRequest(http.MethodGet, p.config.UserInfoURL, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to new http request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user information")
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read response body")
	}

	var claims map[string]any
	err = json.Unmarshal(body, &claims)
	if err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

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
	return userInfo, nil
}

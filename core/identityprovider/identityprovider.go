// Package identityprovider holds the rules an identity provider must meet
// before it is stored, whichever path writes it.
package identityprovider

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/identifier"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// Validate reports the first rule the provider breaks, or nil. It checks the
// complete provider as it would be stored, so an update is validated after it
// is merged with the stored provider.
func Validate(provider *storepb.IdentityProvider) error {
	if provider == nil {
		return errors.New("identity provider is required")
	}
	if !identifier.UIDMatcher.MatchString(provider.Uid) {
		return errors.New("uid must be 1-36 characters, contain only letters, digits, or hyphens, and start and end with a letter or digit")
	}
	if strings.TrimSpace(provider.Name) == "" {
		return errors.New("title is required")
	}
	if provider.IdentifierFilter != "" {
		if _, err := regexp.Compile(provider.IdentifierFilter); err != nil {
			return errors.Wrap(err, "identifier_filter must be a valid regular expression")
		}
	}
	switch provider.Type {
	case storepb.IdentityProvider_OAUTH2:
		return validateOAuth2Config(provider.GetConfig().GetOauth2Config())
	default:
		return errors.New("type must be OAUTH2")
	}
}

func validateOAuth2Config(config *storepb.OAuth2Config) error {
	if config == nil {
		return errors.New("config.oauth2_config is required")
	}
	if strings.TrimSpace(config.ClientId) == "" {
		return errors.New("config.oauth2_config.client_id is required")
	}
	for _, field := range []struct {
		name  string
		value string
	}{
		{name: "auth_url", value: config.AuthUrl},
		{name: "token_url", value: config.TokenUrl},
		{name: "user_info_url", value: config.UserInfoUrl},
	} {
		if !isAbsoluteHTTPURL(field.value) {
			return errors.Errorf("config.oauth2_config.%s must be an absolute HTTP(S) URL", field.name)
		}
	}
	for i, scope := range config.Scopes {
		if strings.TrimSpace(scope) == "" {
			return errors.Errorf("config.oauth2_config.scopes[%d] must not be empty", i)
		}
	}
	if strings.TrimSpace(config.GetFieldMapping().GetIdentifier()) == "" {
		return errors.New("config.oauth2_config.field_mapping.identifier is required")
	}
	return nil
}

func isAbsoluteHTTPURL(value string) bool {
	parsed, err := url.ParseRequestURI(value)
	if err != nil {
		return false
	}
	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

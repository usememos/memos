package store

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/base"
	storepb "github.com/usememos/memos/proto/gen/store"
)

const (
	maxIdentityProviderBootstrapSize    = 1 << 20
	defaultIdentityProviderBootstrapDir = "/etc/secrets"
	identityProviderBootstrapPrefix     = "memos-idp-"
	identityProviderBootstrapSuffix     = ".json"
)

// ApplyIdentityProviderBootstrapDir validates and reconciles identity providers
// from memos-idp-*.json files in a directory. Providers not named in those files
// are left unchanged.
func (s *Store) ApplyIdentityProviderBootstrapDir(ctx context.Context, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return errors.Wrap(err, "failed to read identity provider bootstrap directory")
	}

	providers := []*storepb.IdentityProvider{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), identityProviderBootstrapPrefix) || !strings.HasSuffix(entry.Name(), identityProviderBootstrapSuffix) {
			continue
		}
		provider, err := readIdentityProviderBootstrap(filepath.Join(dir, entry.Name()))
		if err != nil {
			return errors.Wrapf(err, "invalid identity provider bootstrap file %q", entry.Name())
		}
		providers = append(providers, provider)
	}
	if err := validateIdentityProviderBootstrap(providers); err != nil {
		return err
	}

	for _, provider := range providers {
		existing, err := s.GetIdentityProvider(ctx, &FindIdentityProvider{UID: &provider.Uid})
		if err != nil {
			return errors.Wrapf(err, "failed to look up identity provider %q", provider.Uid)
		}
		if existing == nil {
			if _, err := s.CreateIdentityProvider(ctx, provider); err != nil {
				return errors.Wrapf(err, "failed to create identity provider %q", provider.Uid)
			}
			continue
		}
		if existing.Type != provider.Type {
			return errors.Errorf("identity provider %q has type %s, expected %s", provider.Uid, existing.Type, provider.Type)
		}

		title := provider.Name
		identifierFilter := provider.IdentifierFilter
		if _, err := s.UpdateIdentityProvider(ctx, &UpdateIdentityProviderV1{
			ID:               existing.Id,
			Type:             existing.Type,
			Name:             &title,
			IdentifierFilter: &identifierFilter,
			Config:           provider.Config,
		}); err != nil {
			return errors.Wrapf(err, "failed to update identity provider %q", provider.Uid)
		}
	}

	return nil
}

func readIdentityProviderBootstrap(path string) (*storepb.IdentityProvider, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read identity provider bootstrap file")
	}
	defer file.Close()

	content, err := io.ReadAll(io.LimitReader(file, maxIdentityProviderBootstrapSize+1))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read identity provider bootstrap file")
	}
	if len(content) > maxIdentityProviderBootstrapSize {
		return nil, errors.Errorf("identity provider bootstrap file exceeds %d bytes", maxIdentityProviderBootstrapSize)
	}

	provider := &storepb.IdentityProvider{}
	if err := protojson.Unmarshal(content, provider); err != nil {
		return nil, errors.Wrap(err, "failed to decode identity provider bootstrap file")
	}
	return provider, nil
}

func validateIdentityProviderBootstrap(providers []*storepb.IdentityProvider) error {
	seenUIDs := make(map[string]struct{}, len(providers))
	for i, provider := range providers {
		if provider.Id != 0 {
			return errors.Errorf("identityProviders[%d].id must be omitted", i)
		}
		if !base.UIDMatcher.MatchString(provider.Uid) {
			return errors.Errorf("identityProviders[%d].uid is invalid", i)
		}
		if _, exists := seenUIDs[provider.Uid]; exists {
			return errors.Errorf("identityProviders[%d].uid duplicates %q", i, provider.Uid)
		}
		seenUIDs[provider.Uid] = struct{}{}
		if strings.TrimSpace(provider.Name) == "" {
			return errors.Errorf("identityProviders[%d].name is required", i)
		}
		if provider.Type != storepb.IdentityProvider_OAUTH2 {
			return errors.Errorf("identityProviders[%d].type must be OAUTH2", i)
		}
		if err := validateBootstrapOAuth2Config(provider.Config.GetOauth2Config(), i); err != nil {
			return err
		}
	}
	return nil
}

func validateBootstrapOAuth2Config(config *storepb.OAuth2Config, index int) error {
	if config == nil {
		return errors.Errorf("identityProviders[%d].config.oauth2Config is required", index)
	}
	required := []struct {
		name  string
		value string
	}{
		{name: "clientId", value: config.ClientId},
		{name: "clientSecret", value: config.ClientSecret},
		{name: "authUrl", value: config.AuthUrl},
		{name: "tokenUrl", value: config.TokenUrl},
		{name: "userInfoUrl", value: config.UserInfoUrl},
	}
	if config.FieldMapping == nil {
		return errors.Errorf("identityProviders[%d].config.oauth2Config.fieldMapping is required", index)
	}
	required = append(required, struct {
		name  string
		value string
	}{name: "fieldMapping.identifier", value: config.FieldMapping.Identifier})
	for _, field := range required {
		if strings.TrimSpace(field.value) == "" {
			return errors.Errorf("identityProviders[%d].config.oauth2Config.%s is required", index, field.name)
		}
	}
	if len(config.Scopes) == 0 {
		return errors.Errorf("identityProviders[%d].config.oauth2Config.scopes is required", index)
	}
	for scopeIndex, scope := range config.Scopes {
		if strings.TrimSpace(scope) == "" {
			return errors.Errorf("identityProviders[%d].config.oauth2Config.scopes[%d] must not be empty", index, scopeIndex)
		}
	}
	return nil
}

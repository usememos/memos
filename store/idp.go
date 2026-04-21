package store

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type IdentityProvider struct {
	ID               int32
	UID              string
	Name             string
	Type             storepb.IdentityProvider_Type
	IdentifierFilter string
	Config           string
}

type FindIdentityProvider struct {
	ID  *int32
	UID *string
}

type UpdateIdentityProvider struct {
	ID               int32
	Name             *string
	IdentifierFilter *string
	Config           *string
}

type DeleteIdentityProvider struct {
	ID int32
}

func (s *Store) CreateIdentityProvider(ctx context.Context, create *storepb.IdentityProvider) (*storepb.IdentityProvider, error) {
	raw, err := convertIdentityProviderToRaw(create)
	if err != nil {
		return nil, err
	}
	identityProviderRaw, err := s.driver.CreateIdentityProvider(ctx, raw)
	if err != nil {
		return nil, err
	}

	identityProvider, err := convertIdentityProviderFromRaw(identityProviderRaw)
	if err != nil {
		return nil, err
	}
	return identityProvider, nil
}

func (s *Store) ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*storepb.IdentityProvider, error) {
	list, err := s.driver.ListIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}

	identityProviders := []*storepb.IdentityProvider{}
	for _, raw := range list {
		identityProvider, err := convertIdentityProviderFromRaw(raw)
		if err != nil {
			return nil, err
		}
		identityProviders = append(identityProviders, identityProvider)
	}
	return identityProviders, nil
}

func (s *Store) GetIdentityProvider(ctx context.Context, find *FindIdentityProvider) (*storepb.IdentityProvider, error) {
	list, err := s.ListIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.Errorf("Found multiple identity providers with ID %d", *find.ID)
	}

	identityProvider := list[0]
	return identityProvider, nil
}

type UpdateIdentityProviderV1 struct {
	ID               int32
	Type             storepb.IdentityProvider_Type
	Name             *string
	IdentifierFilter *string
	Config           *storepb.IdentityProviderConfig
}

func (s *Store) UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProviderV1) (*storepb.IdentityProvider, error) {
	updateRaw := &UpdateIdentityProvider{
		ID: update.ID,
	}
	if update.Name != nil {
		updateRaw.Name = update.Name
	}
	if update.IdentifierFilter != nil {
		updateRaw.IdentifierFilter = update.IdentifierFilter
	}
	if update.Config != nil {
		configRaw, err := convertIdentityProviderConfigToRaw(update.Type, update.Config)
		if err != nil {
			return nil, err
		}
		updateRaw.Config = &configRaw
	}
	identityProviderRaw, err := s.driver.UpdateIdentityProvider(ctx, updateRaw)
	if err != nil {
		return nil, err
	}

	identityProvider, err := convertIdentityProviderFromRaw(identityProviderRaw)
	if err != nil {
		return nil, err
	}
	return identityProvider, nil
}

func (s *Store) DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error {
	err := s.driver.DeleteIdentityProvider(ctx, delete)
	if err != nil {
		return err
	}
	return nil
}

func convertIdentityProviderFromRaw(raw *IdentityProvider) (*storepb.IdentityProvider, error) {
	identityProvider := &storepb.IdentityProvider{
		Id:               raw.ID,
		Uid:              raw.UID,
		Name:             raw.Name,
		Type:             raw.Type,
		IdentifierFilter: raw.IdentifierFilter,
	}
	config, err := convertIdentityProviderConfigFromRaw(identityProvider.Type, raw.Config)
	if err != nil {
		return nil, err
	}
	identityProvider.Config = config
	return identityProvider, nil
}

func convertIdentityProviderToRaw(identityProvider *storepb.IdentityProvider) (*IdentityProvider, error) {
	raw := &IdentityProvider{
		ID:               identityProvider.Id,
		UID:              identityProvider.Uid,
		Name:             identityProvider.Name,
		Type:             identityProvider.Type,
		IdentifierFilter: identityProvider.IdentifierFilter,
	}
	configRaw, err := convertIdentityProviderConfigToRaw(identityProvider.Type, identityProvider.Config)
	if err != nil {
		return nil, err
	}
	raw.Config = configRaw
	return raw, nil
}

func convertIdentityProviderConfigFromRaw(identityProviderType storepb.IdentityProvider_Type, raw string) (*storepb.IdentityProviderConfig, error) {
	// Try new format: full IdentityProviderConfig JSON (written by current code).
	config := &storepb.IdentityProviderConfig{}
	if err := protojsonUnmarshaler.Unmarshal([]byte(raw), config); err == nil && config.GetOauth2Config() != nil {
		return config, nil
	}

	// Fall back to legacy format: raw OAuth2Config JSON (written by old code).
	// In the legacy format the JSON keys belong to OAuth2Config directly, so
	// oauth2_config is nil after unmarshaling into IdentityProviderConfig.
	config = &storepb.IdentityProviderConfig{}
	if identityProviderType == storepb.IdentityProvider_OAUTH2 {
		oauth2Config := &storepb.OAuth2Config{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw), oauth2Config); err != nil {
			return nil, errors.Wrap(err, "Failed to unmarshal OAuth2Config")
		}
		config.Config = &storepb.IdentityProviderConfig_Oauth2Config{Oauth2Config: oauth2Config}
	}
	return config, nil
}

func convertIdentityProviderConfigToRaw(identityProviderType storepb.IdentityProvider_Type, config *storepb.IdentityProviderConfig) (string, error) {
	if identityProviderType == storepb.IdentityProvider_OAUTH2 {
		// Marshal the full IdentityProviderConfig so that identifier_transform
		// (a field on IdentityProviderConfig, not OAuth2Config) is persisted.
		bytes, err := protojson.Marshal(config)
		if err != nil {
			return "", errors.Wrap(err, "Failed to marshal IdentityProviderConfig")
		}
		return string(bytes), nil
	}
	return "", nil
}

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
	stored, err := s.listStoredIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}
	// File-backed providers do not have database IDs. ID-filtered reads are raw
	// stored-resource lookups used by mutation paths.
	if find.ID != nil {
		return stored, nil
	}
	if find.UID != nil {
		if provider := s.getDeploymentIdentityProvider(*find.UID); provider != nil {
			return []*storepb.IdentityProvider{provider}, nil
		}
		return stored, nil
	}

	deploymentProviders := s.listDeploymentIdentityProviders()
	deploymentByUID := make(map[string]*storepb.IdentityProvider, len(deploymentProviders))
	for _, provider := range deploymentProviders {
		deploymentByUID[provider.Uid] = provider
	}
	identityProviders := make([]*storepb.IdentityProvider, 0, len(stored)+len(deploymentProviders))
	for _, provider := range stored {
		if configured := deploymentByUID[provider.Uid]; configured != nil {
			identityProviders = append(identityProviders, configured)
			delete(deploymentByUID, provider.Uid)
			continue
		}
		identityProviders = append(identityProviders, provider)
	}
	// listDeploymentIdentityProviders is UID-sorted, so providers that exist
	// only in deployment configuration are appended deterministically without
	// reordering existing database-backed providers.
	for _, provider := range deploymentProviders {
		if deploymentByUID[provider.Uid] != nil {
			identityProviders = append(identityProviders, provider)
		}
	}
	return identityProviders, nil
}

func (s *Store) listStoredIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*storepb.IdentityProvider, error) {
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
		return nil, errors.New("found multiple identity providers")
	}

	identityProvider := list[0]
	return identityProvider, nil
}

// GetStoredIdentityProvider returns a database-backed provider without deployment shadowing.
func (s *Store) GetStoredIdentityProvider(ctx context.Context, find *FindIdentityProvider) (*storepb.IdentityProvider, error) {
	list, err := s.listStoredIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.New("found multiple stored identity providers")
	}
	return list[0], nil
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
	config := &storepb.IdentityProviderConfig{}
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
	raw := ""
	if identityProviderType == storepb.IdentityProvider_OAUTH2 {
		bytes, err := protojson.Marshal(config.GetOauth2Config())
		if err != nil {
			return "", errors.Wrap(err, "Failed to marshal OAuth2Config")
		}
		raw = string(bytes)
	}
	return raw, nil
}

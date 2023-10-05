package store

import (
	"context"
)

type IdentityProviderType string

const (
	IdentityProviderOAuth2Type IdentityProviderType = "OAUTH2"
)

func (t IdentityProviderType) String() string {
	return string(t)
}

type IdentityProviderConfig struct {
	OAuth2Config *IdentityProviderOAuth2Config
}

type IdentityProviderOAuth2Config struct {
	ClientID     string        `json:"clientId"`
	ClientSecret string        `json:"clientSecret"`
	AuthURL      string        `json:"authUrl"`
	TokenURL     string        `json:"tokenUrl"`
	UserInfoURL  string        `json:"userInfoUrl"`
	Scopes       []string      `json:"scopes"`
	FieldMapping *FieldMapping `json:"fieldMapping"`
}

type FieldMapping struct {
	Identifier  string `json:"identifier"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
}

type IdentityProvider struct {
	ID               int32
	Name             string
	Type             IdentityProviderType
	IdentifierFilter string
	Config           *IdentityProviderConfig
}

type FindIdentityProvider struct {
	ID *int32
}

type UpdateIdentityProvider struct {
	ID               int32
	Type             IdentityProviderType
	Name             *string
	IdentifierFilter *string
	Config           *IdentityProviderConfig
}

type DeleteIdentityProvider struct {
	ID int32
}

func (s *Store) CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error) {
	identityProvider, err := s.driver.CreateIdentityProvider(ctx, create)
	if err != nil {
		return nil, err
	}

	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error) {
	identityProviders, err := s.driver.ListIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, item := range identityProviders {
		s.idpCache.Store(item.ID, item)
	}
	return identityProviders, nil
}

func (s *Store) GetIdentityProvider(ctx context.Context, find *FindIdentityProvider) (*IdentityProvider, error) {
	if find.ID != nil {
		if cache, ok := s.idpCache.Load(*find.ID); ok {
			return cache.(*IdentityProvider), nil
		}
	}

	list, err := s.ListIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	identityProvider := list[0]
	return identityProvider, nil
}

func (s *Store) UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error) {
	identityProvider, err := s.driver.UpdateIdentityProvider(ctx, update)
	if err != nil {
		return nil, err
	}

	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error {
	err := s.driver.DeleteIdentityProvider(ctx, delete)
	if err != nil {
		return err
	}

	s.idpCache.Delete(delete.ID)
	return nil
}

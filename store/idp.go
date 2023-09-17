package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pkg/errors"
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
	var configBytes []byte
	if create.Type == IdentityProviderOAuth2Type {
		bytes, err := json.Marshal(create.Config.OAuth2Config)
		if err != nil {
			return nil, err
		}
		configBytes = bytes
	} else {
		return nil, errors.Errorf("unsupported idp type %s", string(create.Type))
	}

	stmt := `
		INSERT INTO idp (
			name,
			type,
			identifier_filter,
			config
		)
		VALUES (?, ?, ?, ?)
		RETURNING id
	`
	if err := s.db.QueryRowContext(
		ctx,
		stmt,
		create.Name,
		create.Type,
		create.IdentifierFilter,
		string(configBytes),
	).Scan(
		&create.ID,
	); err != nil {
		return nil, err
	}

	identityProvider := create
	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, fmt.Sprintf("id = $%d", len(args)+1)), append(args, *v)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id,
			name,
			type,
			identifier_filter,
			config
		FROM idp
		WHERE `+strings.Join(where, " AND ")+` ORDER BY id ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var identityProviders []*IdentityProvider
	for rows.Next() {
		var identityProvider IdentityProvider
		var identityProviderConfig string
		if err := rows.Scan(
			&identityProvider.ID,
			&identityProvider.Name,
			&identityProvider.Type,
			&identityProvider.IdentifierFilter,
			&identityProviderConfig,
		); err != nil {
			return nil, err
		}

		if identityProvider.Type == IdentityProviderOAuth2Type {
			oauth2Config := &IdentityProviderOAuth2Config{}
			if err := json.Unmarshal([]byte(identityProviderConfig), oauth2Config); err != nil {
				return nil, err
			}
			identityProvider.Config = &IdentityProviderConfig{
				OAuth2Config: oauth2Config,
			}
		} else {
			return nil, errors.Errorf("unsupported idp type %s", string(identityProvider.Type))
		}
		identityProviders = append(identityProviders, &identityProvider)
	}

	if err := rows.Err(); err != nil {
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
	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error) {
	set, args := []string{}, []any{}
	if v := update.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := update.IdentifierFilter; v != nil {
		set, args = append(set, "identifier_filter = ?"), append(args, *v)
	}
	if v := update.Config; v != nil {
		var configBytes []byte
		if update.Type == IdentityProviderOAuth2Type {
			bytes, err := json.Marshal(update.Config.OAuth2Config)
			if err != nil {
				return nil, err
			}
			configBytes = bytes
		} else {
			return nil, errors.Errorf("unsupported idp type %s", string(update.Type))
		}
		set, args = append(set, "config = ?"), append(args, string(configBytes))
	}
	args = append(args, update.ID)

	stmt := `
		UPDATE idp
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, name, type, identifier_filter, config
	`
	var identityProvider IdentityProvider
	var identityProviderConfig string
	if err := s.db.QueryRowContext(ctx, stmt, args...).Scan(
		&identityProvider.ID,
		&identityProvider.Name,
		&identityProvider.Type,
		&identityProvider.IdentifierFilter,
		&identityProviderConfig,
	); err != nil {
		return nil, err
	}

	if identityProvider.Type == IdentityProviderOAuth2Type {
		oauth2Config := &IdentityProviderOAuth2Config{}
		if err := json.Unmarshal([]byte(identityProviderConfig), oauth2Config); err != nil {
			return nil, err
		}
		identityProvider.Config = &IdentityProviderConfig{
			OAuth2Config: oauth2Config,
		}
	} else {
		return nil, errors.Errorf("unsupported idp type %s", string(identityProvider.Type))
	}

	s.idpCache.Store(identityProvider.ID, identityProvider)
	return &identityProvider, nil
}

func (s *Store) DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error {
	where, args := []string{"id = ?"}, []any{delete.ID}
	stmt := `DELETE FROM idp WHERE ` + strings.Join(where, " AND ")
	result, err := s.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	s.idpCache.Delete(delete.ID)
	return nil
}

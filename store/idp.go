package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
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
	ID               int
	Name             string
	Type             IdentityProviderType
	IdentifierFilter string
	Config           *IdentityProviderConfig
}

type FindIdentityProvider struct {
	ID *int
}

type UpdateIdentityProvider struct {
	ID               int
	Type             IdentityProviderType
	Name             *string
	IdentifierFilter *string
	Config           *IdentityProviderConfig
}

type DeleteIdentityProvider struct {
	ID int
}

func (s *Store) CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var configBytes []byte
	if create.Type == IdentityProviderOAuth2Type {
		configBytes, err = json.Marshal(create.Config.OAuth2Config)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, fmt.Errorf("unsupported idp type %s", string(create.Type))
	}

	query := `
		INSERT INTO idp (
			name,
			type,
			identifier_filter,
			config
		)
		VALUES (?, ?, ?, ?)
		RETURNING id
	`
	if err := tx.QueryRowContext(
		ctx,
		query,
		create.Name,
		create.Type,
		create.IdentifierFilter,
		string(configBytes),
	).Scan(
		&create.ID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	identityProvider := create
	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listIdentityProviders(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	for _, item := range list {
		s.idpCache.Store(item.ID, item)
	}
	return list, nil
}

func (s *Store) GetIdentityProvider(ctx context.Context, find *FindIdentityProvider) (*IdentityProvider, error) {
	if find.ID != nil {
		if cache, ok := s.idpCache.Load(*find.ID); ok {
			return cache.(*IdentityProvider), nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listIdentityProviders(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	identityProvider := list[0]
	s.idpCache.Store(identityProvider.ID, identityProvider)
	return identityProvider, nil
}

func (s *Store) UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

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
			configBytes, err = json.Marshal(update.Config.OAuth2Config)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, fmt.Errorf("unsupported idp type %s", string(update.Type))
		}
		set, args = append(set, "config = ?"), append(args, string(configBytes))
	}
	args = append(args, update.ID)

	query := `
		UPDATE idp
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, name, type, identifier_filter, config
	`
	var identityProvider IdentityProvider
	var identityProviderConfig string
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
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
		return nil, fmt.Errorf("unsupported idp type %s", string(identityProvider.Type))
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	s.idpCache.Store(identityProvider.ID, identityProvider)
	return &identityProvider, nil
}

func (s *Store) DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	where, args := []string{"id = ?"}, []any{delete.ID}
	stmt := `DELETE FROM idp WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}

	if _, err = result.RowsAffected(); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	s.idpCache.Delete(delete.ID)
	return nil
}

func listIdentityProviders(ctx context.Context, tx *sql.Tx, find *FindIdentityProvider) ([]*IdentityProvider, error) {
	where, args := []string{"TRUE"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, fmt.Sprintf("id = $%d", len(args)+1)), append(args, *v)
	}

	rows, err := tx.QueryContext(ctx, `
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
			return nil, fmt.Errorf("unsupported idp type %s", string(identityProvider.Type))
		}
		identityProviders = append(identityProviders, &identityProvider)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return identityProviders, nil
}

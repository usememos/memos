package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/usememos/memos/common"
)

type IdentityProviderType string

const (
	IdentityProviderOAuth2 IdentityProviderType = "OAUTH2"
)

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

type IdentityProviderMessage struct {
	ID               int
	Name             string
	Type             IdentityProviderType
	IdentifierFilter string
	Config           *IdentityProviderConfig
}

type FindIdentityProviderMessage struct {
	ID *int
}

type UpdateIdentityProviderMessage struct {
	ID               int
	Type             IdentityProviderType
	Name             *string
	IdentifierFilter *string
	Config           *IdentityProviderConfig
}

type DeleteIdentityProviderMessage struct {
	ID int
}

func (s *Store) CreateIdentityProvider(ctx context.Context, create *IdentityProviderMessage) (*IdentityProviderMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	var configBytes []byte
	if create.Type == IdentityProviderOAuth2 {
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
		return nil, FormatError(err)
	}
	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}
	identityProviderMessage := create
	s.idpCache.Store(identityProviderMessage.ID, identityProviderMessage)
	return identityProviderMessage, nil
}

func (s *Store) ListIdentityProviders(ctx context.Context, find *FindIdentityProviderMessage) ([]*IdentityProviderMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listIdentityProviders(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	for _, item := range list {
		s.idpCache.Store(item.ID, item)
	}
	return list, nil
}

func (s *Store) GetIdentityProvider(ctx context.Context, find *FindIdentityProviderMessage) (*IdentityProviderMessage, error) {
	if find.ID != nil {
		if cache, ok := s.idpCache.Load(*find.ID); ok {
			return cache.(*IdentityProviderMessage), nil
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := listIdentityProviders(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	identityProviderMessage := list[0]
	s.idpCache.Store(identityProviderMessage.ID, identityProviderMessage)
	return identityProviderMessage, nil
}

func (s *Store) UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProviderMessage) (*IdentityProviderMessage, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	set, args := []string{}, []interface{}{}
	if v := update.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := update.IdentifierFilter; v != nil {
		set, args = append(set, "identifier_filter = ?"), append(args, *v)
	}
	if v := update.Config; v != nil {
		var configBytes []byte
		if update.Type == IdentityProviderOAuth2 {
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
	var identityProviderMessage IdentityProviderMessage
	var identityProviderConfig string
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&identityProviderMessage.ID,
		&identityProviderMessage.Name,
		&identityProviderMessage.Type,
		&identityProviderMessage.IdentifierFilter,
		&identityProviderConfig,
	); err != nil {
		return nil, FormatError(err)
	}
	if identityProviderMessage.Type == IdentityProviderOAuth2 {
		oauth2Config := &IdentityProviderOAuth2Config{}
		if err := json.Unmarshal([]byte(identityProviderConfig), oauth2Config); err != nil {
			return nil, err
		}
		identityProviderMessage.Config = &IdentityProviderConfig{
			OAuth2Config: oauth2Config,
		}
	} else {
		return nil, fmt.Errorf("unsupported idp type %s", string(identityProviderMessage.Type))
	}
	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}
	s.idpCache.Store(identityProviderMessage.ID, identityProviderMessage)
	return &identityProviderMessage, nil
}

func (s *Store) DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProviderMessage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	where, args := []string{"id = ?"}, []interface{}{delete.ID}
	stmt := `DELETE FROM idp WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("idp not found")}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	s.idpCache.Delete(delete.ID)
	return nil
}

func listIdentityProviders(ctx context.Context, tx *sql.Tx, find *FindIdentityProviderMessage) ([]*IdentityProviderMessage, error) {
	where, args := []string{"TRUE"}, []interface{}{}
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
		return nil, FormatError(err)
	}
	defer rows.Close()

	var identityProviderMessages []*IdentityProviderMessage
	for rows.Next() {
		var identityProviderMessage IdentityProviderMessage
		var identityProviderConfig string
		if err := rows.Scan(
			&identityProviderMessage.ID,
			&identityProviderMessage.Name,
			&identityProviderMessage.Type,
			&identityProviderMessage.IdentifierFilter,
			&identityProviderConfig,
		); err != nil {
			return nil, FormatError(err)
		}
		if identityProviderMessage.Type == IdentityProviderOAuth2 {
			oauth2Config := &IdentityProviderOAuth2Config{}
			if err := json.Unmarshal([]byte(identityProviderConfig), oauth2Config); err != nil {
				return nil, err
			}
			identityProviderMessage.Config = &IdentityProviderConfig{
				OAuth2Config: oauth2Config,
			}
		} else {
			return nil, fmt.Errorf("unsupported idp type %s", string(identityProviderMessage.Type))
		}
		identityProviderMessages = append(identityProviderMessages, &identityProviderMessage)
	}
	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}
	return identityProviderMessages, nil
}

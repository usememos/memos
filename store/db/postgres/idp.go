package postgres

import (
	"context"
	"encoding/json"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	var configBytes []byte
	if create.Type == store.IdentityProviderOAuth2Type {
		bytes, err := json.Marshal(create.Config.OAuth2Config)
		if err != nil {
			return nil, err
		}
		configBytes = bytes
	} else {
		return nil, errors.Errorf("unsupported idp type %s", string(create.Type))
	}

	qb := squirrel.Insert("idp").Columns("name", "type", "identifier_filter", "config")
	values := []any{create.Name, create.Type, create.IdentifierFilter, string(configBytes)}

	qb = qb.Values(values...).PlaceholderFormat(squirrel.Dollar)
	qb = qb.Suffix("RETURNING id")

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	var id int32
	err = d.db.QueryRowContext(ctx, stmt, args...).Scan(&id)
	if err != nil {
		return nil, err
	}

	create.ID = id
	return create, nil
}
func (d *DB) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	qb := squirrel.Select("id", "name", "type", "identifier_filter", "config").
		From("idp").
		Where("1 = 1").
		PlaceholderFormat(squirrel.Dollar)

	if v := find.ID; v != nil {
		qb = qb.Where(squirrel.Eq{"id": *v})
	}

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var identityProviders []*store.IdentityProvider
	for rows.Next() {
		var identityProvider store.IdentityProvider
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

		if identityProvider.Type == store.IdentityProviderOAuth2Type {
			oauth2Config := &store.IdentityProviderOAuth2Config{}
			if err := json.Unmarshal([]byte(identityProviderConfig), oauth2Config); err != nil {
				return nil, err
			}
			identityProvider.Config = &store.IdentityProviderConfig{
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

	return identityProviders, nil
}

func (d *DB) GetIdentityProvider(ctx context.Context, find *store.FindIdentityProvider) (*store.IdentityProvider, error) {
	list, err := d.ListIdentityProviders(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (d *DB) UpdateIdentityProvider(ctx context.Context, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	qb := squirrel.Update("idp").
		PlaceholderFormat(squirrel.Dollar)
	var err error

	if v := update.Name; v != nil {
		qb = qb.Set("name", *v)
	}
	if v := update.IdentifierFilter; v != nil {
		qb = qb.Set("identifier_filter", *v)
	}
	if v := update.Config; v != nil {
		var configBytes []byte
		if update.Type == store.IdentityProviderOAuth2Type {
			bytes, err := json.Marshal(update.Config.OAuth2Config)
			if err != nil {
				return nil, err
			}
			configBytes = bytes
		} else {
			return nil, errors.Errorf("unsupported idp type %s", string(update.Type))
		}
		qb = qb.Set("config", string(configBytes))
	}

	qb = qb.Where(squirrel.Eq{"id": update.ID})

	stmt, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	_, err = d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	return d.GetIdentityProvider(ctx, &store.FindIdentityProvider{ID: &update.ID})
}

func (d *DB) DeleteIdentityProvider(ctx context.Context, delete *store.DeleteIdentityProvider) error {
	qb := squirrel.Delete("idp").
		Where(squirrel.Eq{"id": delete.ID}).
		PlaceholderFormat(squirrel.Dollar)

	stmt, args, err := qb.ToSql()
	if err != nil {
		return err
	}

	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}

	if _, err = result.RowsAffected(); err != nil {
		return err
	}

	return nil
}

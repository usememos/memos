package postgres

import (
	"context"
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	fields := []string{"name", "type", "identifier_filter", "config"}
	args := []any{create.Name, create.Type.String(), create.IdentifierFilter, create.Config}
	stmt := "INSERT INTO idp (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID); err != nil {
		return nil, err
	}

	identityProvider := create
	return identityProvider, nil
}

func (d *DB) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *v)
	}

	rows, err := d.db.QueryContext(ctx, `
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

	var identityProviders []*store.IdentityProvider
	for rows.Next() {
		var identityProvider store.IdentityProvider
		var typeString string
		if err := rows.Scan(
			&identityProvider.ID,
			&identityProvider.Name,
			&typeString,
			&identityProvider.IdentifierFilter,
			&identityProvider.Config,
		); err != nil {
			return nil, err
		}

		identityProvider.Type = storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[typeString])
		identityProviders = append(identityProviders, &identityProvider)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return identityProviders, nil
}

func (d *DB) UpdateIdentityProvider(ctx context.Context, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	set, args := []string{}, []any{}
	if v := update.Name; v != nil {
		set, args = append(set, "name = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.IdentifierFilter; v != nil {
		set, args = append(set, "identifier_filter = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Config; v != nil {
		set, args = append(set, "config = "+placeholder(len(args)+1)), append(args, *v)
	}

	stmt := `
		UPDATE idp
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ` + placeholder(len(args)+1) + `
		RETURNING id, name, type, identifier_filter, config
	`
	args = append(args, update.ID)

	var identityProvider store.IdentityProvider
	var typeString string
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&identityProvider.ID,
		&identityProvider.Name,
		&typeString,
		&identityProvider.IdentifierFilter,
		&identityProvider.Config,
	); err != nil {
		return nil, err
	}

	identityProvider.Type = storepb.IdentityProvider_Type(storepb.IdentityProvider_Type_value[typeString])
	return &identityProvider, nil
}

func (d *DB) DeleteIdentityProvider(ctx context.Context, delete *store.DeleteIdentityProvider) error {
	where, args := []string{"id = $1"}, []any{delete.ID}
	stmt := `DELETE FROM idp WHERE ` + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

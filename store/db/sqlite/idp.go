package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	return createIdentityProvider(ctx, d.db, create)
}

// CreateIdentityProviderTx is CreateIdentityProvider within tx.
func (*DB) CreateIdentityProviderTx(ctx context.Context, tx *sql.Tx, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	return createIdentityProvider(ctx, tx, create)
}

func createIdentityProvider(ctx context.Context, q dbExecutor, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	placeholders := []string{"?", "?", "?", "?", "?"}
	fields := []string{"`uid`", "`name`", "`type`", "`identifier_filter`", "`config`"}
	args := []any{create.UID, create.Name, create.Type.String(), create.IdentifierFilter, create.Config}

	stmt := "INSERT INTO `idp` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ") RETURNING `id`"
	if err := q.QueryRowContext(ctx, stmt, args...).Scan(&create.ID); err != nil {
		return nil, err
	}

	identityProvider := create
	return identityProvider, nil
}

func (d *DB) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	return listIdentityProviders(ctx, d.db, find)
}

// ListIdentityProvidersTx is ListIdentityProviders within tx.
func (*DB) ListIdentityProvidersTx(ctx context.Context, tx *sql.Tx, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	return listIdentityProviders(ctx, tx, find)
}

func listIdentityProviders(ctx context.Context, q dbExecutor, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, fmt.Sprintf("id = $%d", len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, fmt.Sprintf("uid = $%d", len(args)+1)), append(args, *v)
	}

	rows, err := q.QueryContext(ctx, `
		SELECT
			id,
			uid,
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
			&identityProvider.UID,
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
	return updateIdentityProvider(ctx, d.db, update)
}

// UpdateIdentityProviderTx is UpdateIdentityProvider within tx.
func (*DB) UpdateIdentityProviderTx(ctx context.Context, tx *sql.Tx, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	return updateIdentityProvider(ctx, tx, update)
}

func updateIdentityProvider(ctx context.Context, q dbExecutor, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	set, args := []string{}, []any{}
	if v := update.Name; v != nil {
		set, args = append(set, "name = ?"), append(args, *v)
	}
	if v := update.IdentifierFilter; v != nil {
		set, args = append(set, "identifier_filter = ?"), append(args, *v)
	}
	if v := update.Config; v != nil {
		set, args = append(set, "config = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	stmt := `
		UPDATE idp
		SET ` + strings.Join(set, ", ") + `
		WHERE id = ?
		RETURNING id, uid, name, type, identifier_filter, config
	`
	var identityProvider store.IdentityProvider
	var typeString string
	if err := q.QueryRowContext(ctx, stmt, args...).Scan(
		&identityProvider.ID,
		&identityProvider.UID,
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
	return deleteIdentityProvider(ctx, d.db, delete)
}

// DeleteIdentityProviderTx is DeleteIdentityProvider within tx.
func (*DB) DeleteIdentityProviderTx(ctx context.Context, tx *sql.Tx, delete *store.DeleteIdentityProvider) error {
	return deleteIdentityProvider(ctx, tx, delete)
}

func deleteIdentityProvider(ctx context.Context, q dbExecutor, delete *store.DeleteIdentityProvider) error {
	where, args := []string{"id = ?"}, []any{delete.ID}
	stmt := `DELETE FROM idp WHERE ` + strings.Join(where, " AND ")
	result, err := q.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

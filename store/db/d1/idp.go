package d1

import (
	"context"
	"strings"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const idpColumns = "id, uid, name, type, identifier_filter, config"

// CreateIdentityProvider inserts an identity provider.
func (d *DB) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	stmt := "INSERT INTO idp (uid, name, type, identifier_filter, config) VALUES (?, ?, ?, ?, ?) RETURNING id"
	if err := d.db.QueryRowContext(ctx, stmt, create.UID, create.Name, create.Type.String(), create.IdentifierFilter, create.Config).Scan(&create.ID); err != nil {
		return nil, err
	}
	return create, nil
}

// ListIdentityProviders returns the identity providers matching find.
func (d *DB) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, "id = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "uid = ?"), append(args, *v)
	}

	rows, err := d.db.QueryContext(ctx, "SELECT "+idpColumns+" FROM idp WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var identityProviders []*store.IdentityProvider
	for rows.Next() {
		identityProvider, err := idpScan(rows)
		if err != nil {
			return nil, err
		}
		identityProviders = append(identityProviders, identityProvider)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return identityProviders, nil
}

// idpScanner is satisfied by *sql.Row and *sql.Rows.
type idpScanner interface {
	Scan(dest ...any) error
}

// idpScan reads one row selected with idpColumns.
func idpScan(scanner idpScanner) (*store.IdentityProvider, error) {
	var identityProvider store.IdentityProvider
	var typeString string
	if err := scanner.Scan(
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

// UpdateIdentityProvider applies the given identity provider changes.
func (d *DB) UpdateIdentityProvider(ctx context.Context, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
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
	if len(set) == 0 {
		// Nothing to change: report the current row rather than sending an
		// empty SET clause.
		return idpScan(d.db.QueryRowContext(ctx, "SELECT "+idpColumns+" FROM idp WHERE id = ?", update.ID))
	}
	args = append(args, update.ID)
	stmt := "UPDATE idp SET " + strings.Join(set, ", ") + " WHERE id = ? RETURNING " + idpColumns
	return idpScan(d.db.QueryRowContext(ctx, stmt, args...))
}

// DeleteIdentityProvider removes an identity provider.
func (d *DB) DeleteIdentityProvider(ctx context.Context, delete *store.DeleteIdentityProvider) error {
	_, err := d.execOne(ctx, "DELETE FROM idp WHERE id = ?", delete.ID)
	return err
}

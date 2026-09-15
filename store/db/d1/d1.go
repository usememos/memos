// Package d1 implements the store driver for Cloudflare D1.
//
// D1 is reached through the Cloudflare REST API rather than a socket, and it
// exposes no interactive transactions. Each driver method therefore performs
// its validation reads first and then commits its writes as one atomic batch.
// Preconditions that must hold at commit time are re-checked inside the batch
// with guard statements (see guard.go) so a stale read never yields a partial
// write.
package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
)

// DB is the D1 store driver.
type DB struct {
	client  *client
	db      *sql.DB
	profile *profile.Profile
}

// NewDB opens a D1 database described by the profile DSN.
func NewDB(profile *profile.Profile) (store.Driver, error) {
	config, err := ParseDSN(profile.DSN)
	if err != nil {
		return nil, err
	}
	c := newClient(config)
	return &DB{client: c, db: openSQLDB(c), profile: profile}, nil
}

// GetDB exposes a database/sql handle over the REST client for the migrator
// and tests. See sqldriver.go for its transaction semantics.
func (d *DB) GetDB() *sql.DB {
	return d.db
}

// Close releases the HTTP connection pool.
func (d *DB) Close() error {
	return d.db.Close()
}

// IsInitialized reports whether the schema has been created.
func (d *DB) IsInitialized(ctx context.Context) (bool, error) {
	var exists bool
	err := d.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'memo')").Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, "failed to check if database is initialized")
	}
	return exists, nil
}

// GetDatabaseSize returns the database size reported by the D1 metadata endpoint.
func (d *DB) GetDatabaseSize(ctx context.Context) (int64, error) {
	size, err := d.client.databaseSize(ctx)
	if err != nil {
		return -1, errors.Wrap(err, "failed to read d1 database size")
	}
	return size, nil
}

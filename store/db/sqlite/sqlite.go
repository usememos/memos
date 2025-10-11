package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
)

type DB struct {
	db      *sql.DB
	profile *profile.Profile
}

// NewDB opens a database specified by its database driver name and a
// driver-specific data source name, usually consisting of at least a
// database name and connection information.
const (
	sqliteBusyTimeout  = 10000
	sqliteModernDriver = "sqlite"
	sqliteCipherDriver = "sqlite3"
)

func NewDB(profile *profile.Profile) (store.Driver, error) {
	// Ensure a DSN is set before attempting to open the database.
	if profile.DSN == "" {
		return nil, errors.New("dsn required")
	}

	sqliteDB, err := openSQLiteDB(profile)
	if err != nil {
		return nil, err
	}

	driver := DB{db: sqliteDB, profile: profile}

	return &driver, nil
}

func configureSQLiteConnection(db *sql.DB) error {
	pragmas := []string{
		"PRAGMA foreign_keys = OFF",
		fmt.Sprintf("PRAGMA busy_timeout = %d", sqliteBusyTimeout),
		"PRAGMA journal_mode = WAL",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			return errors.Wrapf(err, "failed to execute %s", pragma)
		}
	}
	return nil
}

func (d *DB) GetDB() *sql.DB {
	return d.db
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) IsInitialized(ctx context.Context) (bool, error) {
	// Check if the database is initialized by checking if the memo table exists.
	var exists bool
	err := d.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='memo')").Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, "failed to check if database is initialized")
	}
	return exists, nil
}

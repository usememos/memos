//go:build !memos_sqlcipher

package sqlite

import (
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"

	// Import the pure-Go SQLite driver.
	_ "modernc.org/sqlite"
)

func openSQLiteDB(profile *profile.Profile) (*sql.DB, error) {
	if profile.SQLiteEncryptionKey != "" {
		return nil, errors.New("sqlite encryption key provided but binary is not built with SQLCipher support; rebuild with -tags memos_sqlcipher")
	}

	sqliteDB, err := sql.Open(sqliteModernDriver, profile.DSN)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open db with dsn: %s", profile.DSN)
	}

	if err := configureSQLiteConnection(sqliteDB); err != nil {
		sqliteDB.Close()
		return nil, err
	}

	return sqliteDB, nil
}

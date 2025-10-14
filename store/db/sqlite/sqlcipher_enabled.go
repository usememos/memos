//go:build memos_sqlcipher

package sqlite

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"

	// Import the CGO-backed SQLCipher-compatible SQLite driver.
	_ "github.com/mattn/go-sqlite3"
)

func openSQLiteDB(profile *profile.Profile) (*sql.DB, error) {
	sqliteDB, err := sql.Open(sqliteCipherDriver, profile.DSN)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open db with dsn: %s", profile.DSN)
	}

	if err := applySQLiteEncryptionKey(sqliteDB, profile.SQLiteEncryptionKey); err != nil {
		sqliteDB.Close()
		return nil, err
	}

	if err := configureSQLiteConnection(sqliteDB); err != nil {
		sqliteDB.Close()
		return nil, err
	}

	return sqliteDB, nil
}

func applySQLiteEncryptionKey(db *sql.DB, key string) error {
	if key == "" {
		return nil
	}

	escapedKey := strings.ReplaceAll(key, "'", "''")
	pragma := fmt.Sprintf("PRAGMA key = '%s'", escapedKey)
	if _, err := db.Exec(pragma); err != nil {
		return errors.Wrap(err, "failed to apply sqlite encryption key; verify the binary is linked against SQLCipher")
	}

	return nil
}

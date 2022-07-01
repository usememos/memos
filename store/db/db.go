package db

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"sort"

	"github.com/usememos/memos/common"
	"github.com/usememos/memos/server/profile"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

type DB struct {
	// sqlite db connection instance
	Db *sql.DB
	// datasource name
	DSN string
	// mode should be prod or dev
	mode string
}

// NewDB returns a new instance of DB associated with the given datasource name.
func NewDB(profile *profile.Profile) *DB {
	db := &DB{
		DSN:  profile.DSN,
		mode: profile.Mode,
	}
	return db
}

func (db *DB) Open() (err error) {
	// Ensure a DSN is set before attempting to open the database.
	if db.DSN == "" {
		return fmt.Errorf("dsn required")
	}

	// Connect to the database.
	sqlDB, err := sql.Open("sqlite3", db.DSN)
	if err != nil {
		return fmt.Errorf("failed to open db with dsn: %s, err: %w", db.DSN, err)
	}

	db.Db = sqlDB
	// If db file not exists, we should migrate and seed the database.
	if _, err := os.Stat(db.DSN); errors.Is(err, os.ErrNotExist) {
		if err := db.migrate(); err != nil {
			return fmt.Errorf("failed to migrate: %w", err)
		}
		// If mode is dev, then seed the database.
		if db.mode == "dev" {
			if err := db.seed(); err != nil {
				return fmt.Errorf("failed to seed: %w", err)
			}
		}
	} else {
		// If db file exists and mode is dev, we should migrate and seed the database.
		if db.mode == "dev" {
			if err := db.migrate(); err != nil {
				return fmt.Errorf("failed to migrate: %w", err)
			}
			if err := db.seed(); err != nil {
				return fmt.Errorf("failed to seed: %w", err)
			}
		}
	}

	err = db.compareMigrationHistory()
	if err != nil {
		return fmt.Errorf("failed to compare migration history, err=%w", err)
	}

	return err
}

func (db *DB) migrate() error {
	filenames, err := fs.Glob(migrationFS, fmt.Sprintf("%s/*.sql", "migration"))
	if err != nil {
		return err
	}

	sort.Strings(filenames)

	// Loop over all migration files and execute them in order.
	for _, filename := range filenames {
		if err := db.executeFile(migrationFS, filename); err != nil {
			return fmt.Errorf("migrate error: name=%q err=%w", filename, err)
		}
	}
	return nil
}

func (db *DB) seed() error {
	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s/*.sql", "seed"))
	if err != nil {
		return err
	}

	sort.Strings(filenames)

	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		if err := db.executeFile(seedFS, filename); err != nil {
			return fmt.Errorf("seed error: name=%q err=%w", filename, err)
		}
	}
	return nil
}

// executeFile runs a single seed file within a transaction.
func (db *DB) executeFile(FS embed.FS, name string) error {
	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Read and execute SQL file.
	if buf, err := fs.ReadFile(FS, name); err != nil {
		return err
	} else if _, err := tx.Exec(string(buf)); err != nil {
		return err
	}

	return tx.Commit()
}

// compareMigrationHistory compares migration history data
func (db *DB) compareMigrationHistory() error {
	table, err := findTable(db.Db, "migration_history")
	if err != nil {
		return err
	}
	if table == nil {
		if err := createTable(db.Db, `
		CREATE TABLE migration_history (
			version TEXT NOT NULL PRIMARY KEY,
			created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now'))
		);
		`); err != nil {
			return err
		}
	}

	currentVersion := common.Version
	migrationHistory, err := upsertMigrationHistory(db.Db, currentVersion)
	if err != nil {
		return err
	}
	if migrationHistory == nil {
		return fmt.Errorf("failed to upsert migration history")
	}

	return nil
}

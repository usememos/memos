package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"memos/common"
	"os"
	"sort"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migration
var migrationFS embed.FS

//go:embed seed
var seedFS embed.FS

type DB struct {
	Db *sql.DB
	// datasource name
	DSN string
	// mode should be prod or dev
	mode string
}

// NewDB returns a new instance of DB associated with the given datasource name.
func NewDB(profile *common.Profile) *DB {
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
		if err := db.seed(); err != nil {
			return fmt.Errorf("failed to seed: %w", err)
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

func FormatError(err error) error {
	if err == nil {
		return nil
	}

	switch err {
	case sql.ErrNoRows:
		return errors.New("data not found")
	default:
		return err
	}
}

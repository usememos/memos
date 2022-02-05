package store

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed seed
var seedFS embed.FS

type DB struct {
	Db *sql.DB

	// Datasource name.
	DSN string
}

// NewDB returns a new instance of DB associated with the given datasource name.
func NewDB(dsn string) *DB {
	db := &DB{
		DSN: dsn,
	}
	return db
}

func (db *DB) Open() (err error) {
	// Ensure a DSN is set before attempting to open the database.
	if db.DSN == "" {
		return fmt.Errorf("dsn required")
	}

	// Connect to the database.
	if db.Db, err = sql.Open("sqlite3", db.DSN); err != nil {
		return err
	}

	if err := db.seed(); err != nil {
		return fmt.Errorf("failed to seed: %w", err)
	}

	return err
}

func (db *DB) seed() error {
	filenames, err := fs.Glob(seedFS, fmt.Sprintf("%s/*.sql", "seed"))
	if err != nil {
		return err
	}

	sort.Strings(filenames)

	// Loop over all seed files and execute them in order.
	for _, filename := range filenames {
		if err := db.seedFile(filename); err != nil {
			return fmt.Errorf("seed error: name=%q err=%w", filename, err)
		}
	}
	return nil
}

// seedFile runs a single seed file within a transaction.
func (db *DB) seedFile(name string) error {
	tx, err := db.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Read and execute migration file.
	if buf, err := fs.ReadFile(seedFS, name); err != nil {
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

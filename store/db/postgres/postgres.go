package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/pkg/errors"

	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type DB struct {
	db      *sql.DB
	profile *profile.Profile
	// Add any other fields as needed
}

func NewDB(profile *profile.Profile) (store.Driver, error) {
	if profile == nil {
		return nil, errors.New("profile is nil")
	}

	// Open the PostgreSQL connection
	db, err := sql.Open("postgres", profile.DSN)
	if err != nil {
		log.Printf("Failed to open database: %s", err)
		return nil, fmt.Errorf("failed to open database: %v", err)
	}

	var driver store.Driver = &DB{
		db:      db,
		profile: profile,
	}

	// Return the DB struct
	return driver, nil
}

func (d *DB) GetDB() *sql.DB {
	return d.db
}

func (d *DB) Vacuum(ctx context.Context) error {
	return errors.New("unimplemented")
}

func (*DB) BackupTo(context.Context, string) error {
	return errors.New("Please use postgresdump to backup")
}

func (d *DB) GetCurrentDBSize(ctx context.Context) (int64, error) {
	return 0, errors.New("unimplemented")
}

func (d *DB) Close() error {
	return d.db.Close()
}

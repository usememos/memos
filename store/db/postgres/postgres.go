package postgres

import (
	"context"
	"database/sql"
	"log"

	// Import the PostgreSQL driver.
	_ "github.com/lib/pq"
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
		return nil, errors.Wrapf(err, "failed to open database: %s", profile.DSN)
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
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := vacuumMemo(ctx, tx); err != nil {
		return err
	}
	if err := vacuumResource(ctx, tx); err != nil {
		return err
	}
	if err := vacuumUserSetting(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoOrganizer(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoRelations(ctx, tx); err != nil {
		return err
	}
	if err := vacuumInbox(ctx, tx); err != nil {
		return err
	}
	if err := vacuumTag(ctx, tx); err != nil {
		// Prevent revive warning.
		return err
	}

	return tx.Commit()
}

func (*DB) GetCurrentDBSize(context.Context) (int64, error) {
	return 0, errors.New("unimplemented")
}

func (d *DB) Close() error {
	return d.db.Close()
}

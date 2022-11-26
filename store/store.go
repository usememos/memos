package store

import (
	"context"
	"database/sql"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/server/profile"
)

// Store provides database access to all raw objects.
type Store struct {
	db      *sql.DB
	profile *profile.Profile
	cache   api.CacheService
}

// New creates a new instance of Store.
func New(db *sql.DB, profile *profile.Profile) *Store {
	cacheService := NewCacheService()

	return &Store{
		db:      db,
		profile: profile,
		cache:   cacheService,
	}
}

func (s *Store) Vacuum(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := vacuum(ctx, tx); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	// Vacuum sqlite database file size after deleting resource.
	if _, err := s.db.Exec("VACUUM"); err != nil {
		return err
	}

	return nil
}

// Exec vacuum records in a transaction.
func vacuum(ctx context.Context, tx *sql.Tx) error {
	if err := vacuumMemo(ctx, tx); err != nil {
		return err
	}
	if err := vacuumResource(ctx, tx); err != nil {
		return err
	}
	if err := vacuumShortcut(ctx, tx); err != nil {
		return err
	}
	if err := vacuumUserSetting(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoOrganizer(ctx, tx); err != nil {
		return err
	}
	if err := vacuumMemoResource(ctx, tx); err != nil {
		// Prevent revive warning.
		return err
	}

	return nil
}

package postgres

import (
	"context"
	"database/sql"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoOrganizer(ctx context.Context, upsert *store.MemoOrganizer) (*store.MemoOrganizer, error) {
	return nil, nil
}

func (d *DB) ListMemoOrganizer(ctx context.Context, find *store.FindMemoOrganizer) ([]*store.MemoOrganizer, error) {
	return nil, nil
}

func (d *DB) DeleteMemoOrganizer(ctx context.Context, delete *store.DeleteMemoOrganizer) error {
	return nil
}

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	return nil
}

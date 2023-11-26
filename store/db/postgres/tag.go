package postgres

import (
	"context"
	"database/sql"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertTag(ctx context.Context, upsert *store.Tag) (*store.Tag, error) {
	return nil, nil
}

func (d *DB) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	return nil, nil
}

func (d *DB) DeleteTag(ctx context.Context, delete *store.DeleteTag) error {
	return nil
}

func vacuumTag(ctx context.Context, tx *sql.Tx) error {
	return nil
}

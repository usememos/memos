package postgres

import (
	"context"
	"database/sql"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	return nil, nil
}

func (d *DB) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	return nil, nil
}

func (d *DB) UpdateResource(ctx context.Context, update *store.UpdateResource) (*store.Resource, error) {
	return nil, nil
}

func (d *DB) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	return nil
}

func vacuumResource(ctx context.Context, tx *sql.Tx) error {
	return nil
}

package postgres

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateStorage(ctx context.Context, create *store.Storage) (*store.Storage, error) {
	return nil, nil
}

func (d *DB) ListStorages(ctx context.Context, find *store.FindStorage) ([]*store.Storage, error) {
	return nil, nil
}

func (d *DB) UpdateStorage(ctx context.Context, update *store.UpdateStorage) (*store.Storage, error) {
	return nil, nil
}

func (d *DB) DeleteStorage(ctx context.Context, delete *store.DeleteStorage) error {
	return nil
}

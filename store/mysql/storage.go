package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateStorage(ctx context.Context, create *store.Storage) (*store.Storage, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) ListStorages(ctx context.Context, find *store.FindStorage) ([]*store.Storage, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) GetStorage(ctx context.Context, find *store.FindStorage) (*store.Storage, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) UpdateStorage(ctx context.Context, update *store.UpdateStorage) (*store.Storage, error) {
	_, _, _ = d, ctx, update
	return nil, errNotImplemented
}

func (d *Driver) DeleteStorage(ctx context.Context, delete *store.DeleteStorage) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

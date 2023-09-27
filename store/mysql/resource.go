package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateResource(ctx context.Context, create *store.Resource) (*store.Resource, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) ListResources(ctx context.Context, find *store.FindResource) ([]*store.Resource, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) UpdateResource(ctx context.Context, update *store.UpdateResource) (*store.Resource, error) {
	_, _, _ = d, ctx, update
	return nil, errNotImplemented
}

func (d *Driver) DeleteResource(ctx context.Context, delete *store.DeleteResource) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

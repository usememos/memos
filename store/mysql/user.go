package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	_, _, _ = d, ctx, update
	return nil, errNotImplemented
}

func (d *Driver) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

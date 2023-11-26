package postgres

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateUser(ctx context.Context, create *store.User) (*store.User, error) {
	return nil, nil
}

func (d *DB) UpdateUser(ctx context.Context, update *store.UpdateUser) (*store.User, error) {
	return nil, nil
}

func (d *DB) ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error) {
	return nil, nil
}

func (d *DB) GetUser(ctx context.Context, find *store.FindUser) (*store.User, error) {
	return nil, nil
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) error {
	return nil
}

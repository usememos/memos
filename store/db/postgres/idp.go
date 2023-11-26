package postgres

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	//todo
	return nil, nil
}

func (d *DB) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	return nil, nil
}

func (d *DB) GetIdentityProvider(ctx context.Context, find *store.FindIdentityProvider) (*store.IdentityProvider, error) {
	return nil, nil

}

func (d *DB) UpdateIdentityProvider(ctx context.Context, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	return nil, nil
}

func (d *DB) DeleteIdentityProvider(ctx context.Context, delete *store.DeleteIdentityProvider) error {
	return nil
}

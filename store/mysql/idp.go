package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateIdentityProvider(ctx context.Context, create *store.IdentityProvider) (*store.IdentityProvider, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*store.IdentityProvider, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) GetIdentityProvider(ctx context.Context, find *store.FindIdentityProvider) (*store.IdentityProvider, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) UpdateIdentityProvider(ctx context.Context, update *store.UpdateIdentityProvider) (*store.IdentityProvider, error) {
	_, _, _ = d, ctx, update
	return nil, errNotImplemented
}

func (d *Driver) DeleteIdentityProvider(ctx context.Context, delete *store.DeleteIdentityProvider) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

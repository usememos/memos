package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertTag(ctx context.Context, upsert *store.Tag) (*store.Tag, error) {
	_, _, _ = d, ctx, upsert
	return nil, errNotImplemented
}

func (d *Driver) ListTags(ctx context.Context, find *store.FindTag) ([]*store.Tag, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) DeleteTag(ctx context.Context, delete *store.DeleteTag) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

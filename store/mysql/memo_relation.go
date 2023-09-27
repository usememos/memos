package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

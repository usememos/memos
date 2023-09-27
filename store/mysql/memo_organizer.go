package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertMemoOrganizer(ctx context.Context, upsert *store.MemoOrganizer) (*store.MemoOrganizer, error) {
	_, _, _ = d, ctx, upsert
	return nil, errNotImplemented
}

func (d *Driver) GetMemoOrganizer(ctx context.Context, find *store.FindMemoOrganizer) (*store.MemoOrganizer, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) DeleteMemoOrganizer(ctx context.Context, delete *store.DeleteMemoOrganizer) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

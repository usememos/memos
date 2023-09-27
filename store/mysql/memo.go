package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	_, _, _ = d, ctx, create
	return nil, errNotImplemented
}

func (d *Driver) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	_, _, _ = d, ctx, update
	return errNotImplemented
}

func (d *Driver) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	_, _, _ = d, ctx, delete
	return errNotImplemented
}

func (d *Driver) FindMemosVisibilityList(ctx context.Context, memoIDs []int32) ([]store.Visibility, error) {
	_, _, _ = d, ctx, memoIDs
	return nil, errNotImplemented
}

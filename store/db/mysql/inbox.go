package mysql

import (
	"context"

	"github.com/usememos/memos/store"
)

// nolint
func (d *DB) CreateInbox(ctx context.Context, create *store.Inbox) (*store.Inbox, error) {
	return nil, nil
}

// nolint
func (d *DB) ListInboxes(ctx context.Context, find *store.FindInbox) ([]*store.Inbox, error) {
	return nil, nil
}

// nolint
func (d *DB) UpdateInbox(ctx context.Context, update *store.UpdateInbox) (*store.Inbox, error) {
	return nil, nil
}

// nolint
func (d *DB) DeleteInbox(ctx context.Context, delete *store.DeleteInbox) error {
	return nil
}

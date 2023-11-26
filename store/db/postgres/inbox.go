package postgres

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateInbox(ctx context.Context, create *store.Inbox) (*store.Inbox, error) {
	return nil, nil
}

func (d *DB) ListInboxes(ctx context.Context, find *store.FindInbox) ([]*store.Inbox, error) {
	return nil, nil
}

func (d *DB) GetInbox(ctx context.Context, find *store.FindInbox) (*store.Inbox, error) {
	return nil, nil
}

func (d *DB) UpdateInbox(ctx context.Context, update *store.UpdateInbox) (*store.Inbox, error) {
	return nil, nil
}

func (d *DB) DeleteInbox(ctx context.Context, delete *store.DeleteInbox) error {
	return nil
}

package postgres

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateWebhook(ctx context.Context, create *storepb.Webhook) (*storepb.Webhook, error) {
	return nil, nil
}

func (d *DB) ListWebhooks(ctx context.Context, find *store.FindWebhook) ([]*storepb.Webhook, error) {
	return nil, nil
}

func (d *DB) GetWebhook(ctx context.Context, find *store.FindWebhook) (*storepb.Webhook, error) {
	return nil, nil
}

func (d *DB) UpdateWebhook(ctx context.Context, update *store.UpdateWebhook) (*storepb.Webhook, error) {
	return nil, nil
}

func (d *DB) DeleteWebhook(ctx context.Context, delete *store.DeleteWebhook) error {
	return nil
}

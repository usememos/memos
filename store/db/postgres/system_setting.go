package postgres

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertSystemSetting(ctx context.Context, upsert *store.SystemSetting) (*store.SystemSetting, error) {
	return nil, nil
}

func (d *DB) ListSystemSettings(ctx context.Context, find *store.FindSystemSetting) ([]*store.SystemSetting, error) {
	return nil, nil
}

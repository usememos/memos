package postgres

import (
	"context"
	"database/sql"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	return nil, nil
}

func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	return nil, nil
}

func (d *DB) UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	return nil, nil
}

func (d *DB) ListUserSettingsV1(ctx context.Context, find *store.FindUserSettingV1) ([]*storepb.UserSetting, error) {
	return nil, nil
}

func vacuumUserSetting(ctx context.Context, tx *sql.Tx) error {
	return nil
}

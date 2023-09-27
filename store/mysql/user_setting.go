package mysql

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	_, _, _ = d, ctx, upsert
	return nil, errNotImplemented
}

func (d *Driver) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

func (d *Driver) UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	_, _, _ = d, ctx, upsert
	return nil, errNotImplemented
}

func (d *Driver) ListUserSettingsV1(ctx context.Context, find *store.FindUserSettingV1) ([]*storepb.UserSetting, error) {
	_, _, _ = d, ctx, find
	return nil, errNotImplemented
}

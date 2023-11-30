package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
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
	// First, build the subquery
	subQuery, subArgs, err := squirrel.Select("id").From("\"user\"").PlaceholderFormat(squirrel.Dollar).ToSql()
	if err != nil {
		return err
	}

	// Now, build the main delete query using the subquery
	query, args, err := squirrel.Delete("user_setting").
		Where(fmt.Sprintf("user_id NOT IN (%s)", subQuery), subArgs...).
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return err
	}

	// Execute the query
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}

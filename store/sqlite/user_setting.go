package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *Driver) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	stmt := `
		INSERT INTO user_setting (
			user_id, key, value
		)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, key) DO UPDATE 
		SET value = EXCLUDED.value
	`
	if _, err := d.db.ExecContext(ctx, stmt, upsert.UserID, upsert.Key, upsert.Value); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *Driver) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.Key; v != "" {
		where, args = append(where, "key = ?"), append(args, v)
	}
	if v := find.UserID; v != nil {
		where, args = append(where, "user_id = ?"), append(args, *find.UserID)
	}

	query := `
		SELECT
			user_id,
			key,
			value
		FROM user_setting
		WHERE ` + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userSettingList := make([]*store.UserSetting, 0)
	for rows.Next() {
		var userSetting store.UserSetting
		if err := rows.Scan(
			&userSetting.UserID,
			&userSetting.Key,
			&userSetting.Value,
		); err != nil {
			return nil, err
		}
		userSettingList = append(userSettingList, &userSetting)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return userSettingList, nil
}

func (d *Driver) UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	stmt := `
		INSERT INTO user_setting (
			user_id, key, value
		)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, key) DO UPDATE 
		SET value = EXCLUDED.value
	`
	var valueString string
	if upsert.Key == storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS {
		valueBytes, err := protojson.Marshal(upsert.GetAccessTokens())
		if err != nil {
			return nil, err
		}
		valueString = string(valueBytes)
	} else {
		return nil, errors.New("invalid user setting key")
	}

	if _, err := d.db.ExecContext(ctx, stmt, upsert.UserId, upsert.Key.String(), valueString); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *Driver) ListUserSettingsV1(ctx context.Context, find *store.FindUserSettingV1) ([]*storepb.UserSetting, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.Key; v != storepb.UserSettingKey_USER_SETTING_KEY_UNSPECIFIED {
		where, args = append(where, "key = ?"), append(args, v.String())
	}
	if v := find.UserID; v != nil {
		where, args = append(where, "user_id = ?"), append(args, *find.UserID)
	}

	query := `
		SELECT
			user_id,
		  key,
			value
		FROM user_setting
		WHERE ` + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userSettingList := make([]*storepb.UserSetting, 0)
	for rows.Next() {
		userSetting := &storepb.UserSetting{}
		var keyString, valueString string
		if err := rows.Scan(
			&userSetting.UserId,
			&keyString,
			&valueString,
		); err != nil {
			return nil, err
		}
		userSetting.Key = storepb.UserSettingKey(storepb.UserSettingKey_value[keyString])
		if userSetting.Key == storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS {
			accessTokensUserSetting := &storepb.AccessTokensUserSetting{}
			if err := protojson.Unmarshal([]byte(valueString), accessTokensUserSetting); err != nil {
				return nil, err
			}
			userSetting.Value = &storepb.UserSetting_AccessTokens{
				AccessTokens: accessTokensUserSetting,
			}
		} else {
			// Skip unknown user setting v1 key.
			continue
		}
		userSettingList = append(userSettingList, userSetting)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return userSettingList, nil
}

func vacuumUserSetting(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		user_setting 
	WHERE 
		user_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}

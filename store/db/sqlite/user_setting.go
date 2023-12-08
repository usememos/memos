package sqlite

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertUserSetting(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
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
	} else if upsert.Key == storepb.UserSettingKey_USER_SETTING_LOCALE {
		valueString = upsert.GetLocale()
	} else if upsert.Key == storepb.UserSettingKey_USER_SETTING_APPEARANCE {
		valueString = upsert.GetAppearance()
	} else if upsert.Key == storepb.UserSettingKey_USER_SETTING_MEMO_VISIBILITY {
		valueString = upsert.GetMemoVisibility()
	} else if upsert.Key == storepb.UserSettingKey_USER_SETTING_TELEGRAM_USER_ID {
		valueString = upsert.GetTelegramUserId()
	} else {
		return nil, errors.Errorf("unknown user setting key: %s", upsert.Key.String())
	}

	if _, err := d.db.ExecContext(ctx, stmt, upsert.UserId, upsert.Key.String(), valueString); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*storepb.UserSetting, error) {
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
		} else if userSetting.Key == storepb.UserSettingKey_USER_SETTING_LOCALE {
			userSetting.Value = &storepb.UserSetting_Locale{
				Locale: valueString,
			}
		} else if userSetting.Key == storepb.UserSettingKey_USER_SETTING_APPEARANCE {
			userSetting.Value = &storepb.UserSetting_Appearance{
				Appearance: valueString,
			}
		} else if userSetting.Key == storepb.UserSettingKey_USER_SETTING_MEMO_VISIBILITY {
			userSetting.Value = &storepb.UserSetting_MemoVisibility{
				MemoVisibility: valueString,
			}
		} else if userSetting.Key == storepb.UserSettingKey_USER_SETTING_TELEGRAM_USER_ID {
			userSetting.Value = &storepb.UserSetting_TelegramUserId{
				TelegramUserId: valueString,
			}
		} else {
			// Skip unknown user setting key.
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

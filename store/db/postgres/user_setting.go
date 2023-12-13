package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Masterminds/squirrel"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertUserSetting(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
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

	// Construct the query using Squirrel
	query, args, err := squirrel.
		Insert("user_setting").
		Columns("user_id", "key", "value").
		Values(upsert.UserId, upsert.Key.String(), valueString).
		Suffix("ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value").
		PlaceholderFormat(squirrel.Dollar).
		ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query
	if _, err := d.db.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	return upsert, nil
}

func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*storepb.UserSetting, error) {
	// Start building the query using Squirrel
	qb := squirrel.Select("user_id", "key", "value").From("user_setting").PlaceholderFormat(squirrel.Dollar)

	// Add conditions based on the provided find parameters
	if v := find.Key; v != storepb.UserSettingKey_USER_SETTING_KEY_UNSPECIFIED {
		qb = qb.Where(squirrel.Eq{"key": v.String()})
	}
	if v := find.UserID; v != nil {
		qb = qb.Where(squirrel.Eq{"user_id": *v})
	}

	// Finalize the query
	query, args, err := qb.ToSql()
	if err != nil {
		return nil, err
	}

	// Execute the query
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Process the rows
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
	// First, build the subquery
	subQuery, subArgs, err := squirrel.Select("id").From(`"user"`).PlaceholderFormat(squirrel.Dollar).ToSql()
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

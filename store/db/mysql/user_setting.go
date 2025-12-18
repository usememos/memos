package mysql

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	stmt := "INSERT INTO `user_setting` (`user_id`, `key`, `value`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, upsert.UserID, upsert.Key.String(), upsert.Value, upsert.Value); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.Key; v != storepb.UserSetting_KEY_UNSPECIFIED {
		where, args = append(where, "`key` = ?"), append(args, v.String())
	}
	if v := find.UserID; v != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *find.UserID)
	}

	query := "SELECT `user_id`, `key`, `value` FROM `user_setting` WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userSettingList := make([]*store.UserSetting, 0)
	for rows.Next() {
		userSetting := &store.UserSetting{}
		var keyString string
		if err := rows.Scan(
			&userSetting.UserID,
			&keyString,
			&userSetting.Value,
		); err != nil {
			return nil, err
		}
		userSetting.Key = storepb.UserSetting_Key(storepb.UserSetting_Key_value[keyString])
		userSettingList = append(userSettingList, userSetting)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return userSettingList, nil
}

func (d *DB) GetUserByPATHash(ctx context.Context, tokenHash string) (*store.PATQueryResult, error) {
	query := `
		SELECT
			user_id,
			value
		FROM user_setting
		WHERE ` + "`key`" + ` = 'PERSONAL_ACCESS_TOKENS'
		  AND JSON_SEARCH(value, 'one', ?, NULL, '$.tokens[*].tokenHash') IS NOT NULL
	`

	var userID int32
	var tokensJSON string

	err := d.db.QueryRowContext(ctx, query, tokenHash).Scan(&userID, &tokensJSON)
	if err != nil {
		return nil, err
	}

	patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
	if err := protojsonUnmarshaler.Unmarshal([]byte(tokensJSON), patsUserSetting); err != nil {
		return nil, err
	}

	for _, pat := range patsUserSetting.Tokens {
		if pat.TokenHash == tokenHash {
			return &store.PATQueryResult{
				UserID: userID,
				PAT:    pat,
			}, nil
		}
	}

	return nil, errors.New("PAT not found")
}

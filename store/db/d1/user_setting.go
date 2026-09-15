package d1

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// UpsertUserSetting inserts or replaces a user setting.
func (d *DB) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	query := `INSERT INTO user_setting (user_id, key, value) VALUES (?, ?, ?)
		ON CONFLICT(user_id, key) DO UPDATE SET value = EXCLUDED.value`
	if _, err := d.execOne(ctx, query, upsert.UserID, upsert.Key.String(), upsert.Value); err != nil {
		return nil, err
	}
	return upsert, nil
}

// ListUserSettings returns the user settings matching find.
func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.Key; v != storepb.UserSetting_KEY_UNSPECIFIED {
		where, args = append(where, "key = ?"), append(args, v.String())
	}
	if v := find.UserID; v != nil {
		where, args = append(where, "user_id = ?"), append(args, *v)
	}
	rows, err := d.db.QueryContext(ctx, "SELECT user_id, key, value FROM user_setting WHERE "+strings.Join(where, " AND "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.UserSetting, 0)
	for rows.Next() {
		setting := &store.UserSetting{}
		var keyString string
		if err := rows.Scan(&setting.UserID, &keyString, &setting.Value); err != nil {
			return nil, err
		}
		setting.Key = storepb.UserSetting_Key(storepb.UserSetting_Key_value[keyString])
		list = append(list, setting)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

// DeleteUserSettings removes the user settings matching delete.
func (d *DB) DeleteUserSettings(ctx context.Context, delete *store.DeleteUserSetting) error {
	where, args := []string{"1 = 1"}, []any{}
	if v := delete.Key; v != storepb.UserSetting_KEY_UNSPECIFIED {
		where, args = append(where, "key = ?"), append(args, v.String())
	}
	if v := delete.UserID; v != nil {
		where, args = append(where, "user_id = ?"), append(args, *v)
	}
	_, err := d.execOne(ctx, "DELETE FROM user_setting WHERE "+strings.Join(where, " AND "), args...)
	return err
}

// GetUserByPATHash locates the setting row holding the token through D1's
// JSON1 functions and then matches the token in Go.
func (d *DB) GetUserByPATHash(ctx context.Context, tokenHash string) (*store.PATQueryResult, error) {
	query := `SELECT user_setting.user_id, user_setting.value
		FROM user_setting
		WHERE user_setting.key = 'PERSONAL_ACCESS_TOKENS'
			AND EXISTS (
				SELECT 1
				FROM json_each(json_extract(user_setting.value, '$.tokens')) AS token
				WHERE json_extract(token.value, '$.tokenHash') = ?
			)`
	var userID int32
	var tokensJSON string
	if err := d.db.QueryRowContext(ctx, query, tokenHash).Scan(&userID, &tokensJSON); err != nil {
		return nil, err
	}
	setting := &storepb.PersonalAccessTokensUserSetting{}
	if err := protojsonUnmarshaler.Unmarshal([]byte(tokensJSON), setting); err != nil {
		return nil, err
	}
	for _, pat := range setting.Tokens {
		if pat.TokenHash == tokenHash {
			return &store.PATQueryResult{UserID: userID, PAT: pat}, nil
		}
	}
	return nil, errors.New("PAT not found")
}

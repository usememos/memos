package postgres

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) UpsertUserSetting(ctx context.Context, upsert *store.UserSetting) (*store.UserSetting, error) {
	stmt := `
		INSERT INTO user_setting (
			user_id, key, value
		)
		VALUES ($1, $2, $3)
		ON CONFLICT(user_id, key) DO UPDATE 
		SET value = EXCLUDED.value
	`
	if _, err := d.db.ExecContext(ctx, stmt, upsert.UserID, upsert.Key.String(), upsert.Value); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListUserSettings(ctx context.Context, find *store.FindUserSetting) ([]*store.UserSetting, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.Key; v != storepb.UserSetting_KEY_UNSPECIFIED {
		where, args = append(where, "key = "+placeholder(len(args)+1)), append(args, v.String())
	}
	if v := find.UserID; v != nil {
		where, args = append(where, "user_id = "+placeholder(len(args)+1)), append(args, *find.UserID)
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

func (d *DB) GetUserSessionByID(ctx context.Context, sessionID string) (*store.UserSessionQueryResult, error) {
	// Query user_setting that contains this sessionID in the sessions array
	// Use EXISTS with jsonb_array_elements to check array membership
	query := `
		SELECT 
			user_setting.user_id,
			user_setting.value
		FROM user_setting
		WHERE user_setting.key = 'SESSIONS'
		  AND EXISTS (
		      SELECT 1 
		      FROM jsonb_array_elements(user_setting.value::jsonb->'sessions') AS session
		      WHERE session->>'sessionId' = $1
		  )
	`

	var userID int32
	var sessionsJSON string

	err := d.db.QueryRowContext(ctx, query, sessionID).Scan(&userID, &sessionsJSON)
	if err != nil {
		return nil, err
	}

	// Parse the entire sessions list using protobuf unmarshaler
	sessionsUserSetting := &storepb.SessionsUserSetting{}
	if err := protojsonUnmarshaler.Unmarshal([]byte(sessionsJSON), sessionsUserSetting); err != nil {
		return nil, err
	}

	// Find the specific session by ID
	for _, session := range sessionsUserSetting.Sessions {
		if session.SessionId == sessionID {
			return &store.UserSessionQueryResult{
				UserID:  userID,
				Session: session,
			}, nil
		}
	}

	return nil, errors.New("session not found")
}

package store

import (
	"context"
	"database/sql"
	"strings"
)

type UserSetting struct {
	UserID int
	Key    string
	Value  string
}

type FindUserSetting struct {
	UserID *int
	Key    string
}

func (s *Store) UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error) {
	stmt := `
		INSERT INTO user_setting (
			user_id, key, value
		)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, key) DO UPDATE 
		SET value = EXCLUDED.value
	`
	if _, err := s.db.ExecContext(ctx, stmt, upsert.UserID, upsert.Key, upsert.Value); err != nil {
		return nil, err
	}

	userSetting := upsert
	s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserID, userSetting.Key), userSetting)
	return userSetting, nil
}

func (s *Store) ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error) {
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
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	userSettingList := make([]*UserSetting, 0)
	for rows.Next() {
		var userSetting UserSetting
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

	for _, userSetting := range userSettingList {
		s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserID, userSetting.Key), userSetting)
	}
	return userSettingList, nil
}

func (s *Store) GetUserSetting(ctx context.Context, find *FindUserSetting) (*UserSetting, error) {
	if find.UserID != nil {
		if cache, ok := s.userSettingCache.Load(getUserSettingCacheKey(*find.UserID, find.Key)); ok {
			return cache.(*UserSetting), nil
		}
	}

	list, err := s.ListUserSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	userSetting := list[0]
	s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserID, userSetting.Key), userSetting)
	return userSetting, nil
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

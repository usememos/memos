package store

import (
	"context"
	"database/sql"
	"strings"

	"github.com/usememos/memos/api"
)

type userSettingRaw struct {
	UserID int
	Key    api.UserSettingKey
	Value  string
}

func (raw *userSettingRaw) toUserSetting() *api.UserSetting {
	return &api.UserSetting{
		UserID: raw.UserID,
		Key:    raw.Key,
		Value:  raw.Value,
	}
}

func (s *Store) UpsertUserSetting(ctx context.Context, upsert *api.UserSettingUpsert) (*api.UserSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	userSettingRaw, err := upsertUserSetting(ctx, tx, upsert)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	s.userSettingCache.Store(getUserSettingCacheKey(*userSettingRaw), userSettingRaw)
	userSetting := userSettingRaw.toUserSetting()

	return userSetting, nil
}

func (s *Store) FindUserSettingList(ctx context.Context, find *api.UserSettingFind) ([]*api.UserSetting, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	userSettingRawList, err := findUserSettingList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.UserSetting{}
	for _, raw := range userSettingRawList {
		s.userSettingCache.Store(getUserSettingCacheKey(*raw), raw)
		list = append(list, raw.toUserSetting())
	}

	return list, nil
}

func (s *Store) FindUserSetting(ctx context.Context, find *api.UserSettingFind) (*api.UserSetting, error) {
	if userSetting, ok := s.userSettingCache.Load(getUserSettingFindCacheKey(find)); ok {
		if userSetting == nil {
			return nil, nil
		}
		return userSetting.(*userSettingRaw).toUserSetting(), nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findUserSettingList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		s.userSettingCache.Store(getUserSettingFindCacheKey(find), nil)
		return nil, nil
	}

	userSettingRaw := list[0]
	s.userSettingCache.Store(getUserSettingCacheKey(*userSettingRaw), userSettingRaw)
	return userSettingRaw.toUserSetting(), nil
}

func upsertUserSetting(ctx context.Context, tx *sql.Tx, upsert *api.UserSettingUpsert) (*userSettingRaw, error) {
	query := `
		INSERT INTO user_setting (
			user_id, key, value
		)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, key) DO UPDATE 
		SET
			value = EXCLUDED.value
		RETURNING user_id, key, value
	`
	var userSettingRaw userSettingRaw
	if err := tx.QueryRowContext(ctx, query, upsert.UserID, upsert.Key, upsert.Value).Scan(
		&userSettingRaw.UserID,
		&userSettingRaw.Key,
		&userSettingRaw.Value,
	); err != nil {
		return nil, FormatError(err)
	}

	return &userSettingRaw, nil
}

func findUserSettingList(ctx context.Context, tx *sql.Tx, find *api.UserSettingFind) ([]*userSettingRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.Key.String(); v != "" {
		where, args = append(where, "key = ?"), append(args, v)
	}

	where, args = append(where, "user_id = ?"), append(args, find.UserID)

	query := `
		SELECT
			user_id,
		  key,
			value
		FROM user_setting
		WHERE ` + strings.Join(where, " AND ")
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	userSettingRawList := make([]*userSettingRaw, 0)
	for rows.Next() {
		var userSettingRaw userSettingRaw
		if err := rows.Scan(
			&userSettingRaw.UserID,
			&userSettingRaw.Key,
			&userSettingRaw.Value,
		); err != nil {
			return nil, FormatError(err)
		}

		userSettingRawList = append(userSettingRawList, &userSettingRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return userSettingRawList, nil
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
		return FormatError(err)
	}

	return nil
}

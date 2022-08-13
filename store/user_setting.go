package store

import (
	"context"
	"database/sql"

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
		list = append(list, raw.toUserSetting())
	}

	return list, nil
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
	query := `
		SELECT
			user_id,
		  key,
			value
		FROM user_setting
		WHERE user_id = ?
	`
	rows, err := tx.QueryContext(ctx, query, find.UserID)
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

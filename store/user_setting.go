package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type UserSetting struct {
	UserID int32
	Key    string
	Value  string
}

type FindUserSetting struct {
	UserID *int32
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

type FindUserSettingV1 struct {
	UserID *int32
	Key    storepb.UserSettingKey
}

func (s *Store) UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
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

	if _, err := s.db.ExecContext(ctx, stmt, upsert.UserId, upsert.Key.String(), valueString); err != nil {
		return nil, err
	}

	userSettingMessage := upsert
	s.userSettingCache.Store(getUserSettingV1CacheKey(userSettingMessage.UserId, userSettingMessage.Key.String()), userSettingMessage)
	return userSettingMessage, nil
}

func (s *Store) ListUserSettingsV1(ctx context.Context, find *FindUserSettingV1) ([]*storepb.UserSetting, error) {
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
	rows, err := s.db.QueryContext(ctx, query, args...)
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

	for _, userSetting := range userSettingList {
		s.userSettingCache.Store(getUserSettingV1CacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	}
	return userSettingList, nil
}

func (s *Store) GetUserSettingV1(ctx context.Context, find *FindUserSettingV1) (*storepb.UserSetting, error) {
	if find.UserID != nil {
		if cache, ok := s.userSettingCache.Load(getUserSettingV1CacheKey(*find.UserID, find.Key.String())); ok {
			return cache.(*storepb.UserSetting), nil
		}
	}

	list, err := s.ListUserSettingsV1(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	userSetting := list[0]
	s.userSettingCache.Store(getUserSettingV1CacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	return userSetting, nil
}

// GetUserAccessTokens returns the access tokens of the user.
func (s *Store) GetUserAccessTokens(ctx context.Context, userID int32) ([]*storepb.AccessTokensUserSetting_AccessToken, error) {
	userSetting, err := s.GetUserSettingV1(ctx, &FindUserSettingV1{
		UserID: &userID,
		Key:    storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return []*storepb.AccessTokensUserSetting_AccessToken{}, nil
	}

	accessTokensUserSetting := userSetting.GetAccessTokens()
	return accessTokensUserSetting.AccessTokens, nil
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

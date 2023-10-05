package store

import (
	"context"

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
	userSetting, err := s.driver.UpsertUserSetting(ctx, upsert)
	if err != nil {
		return nil, err
	}

	s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserID, userSetting.Key), userSetting)
	return userSetting, nil
}

func (s *Store) ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error) {
	userSettingList, err := s.driver.ListUserSettings(ctx, find)
	if err != nil {
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
	return userSetting, nil
}

type FindUserSettingV1 struct {
	UserID *int32
	Key    storepb.UserSettingKey
}

func (s *Store) UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	userSettingMessage, err := s.driver.UpsertUserSettingV1(ctx, upsert)
	if err != nil {
		return nil, err
	}

	s.userSettingCache.Store(getUserSettingV1CacheKey(userSettingMessage.UserId, userSettingMessage.Key.String()), userSettingMessage)
	return userSettingMessage, nil
}

func (s *Store) ListUserSettingsV1(ctx context.Context, find *FindUserSettingV1) ([]*storepb.UserSetting, error) {
	userSettingList, err := s.driver.ListUserSettingsV1(ctx, find)
	if err != nil {
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

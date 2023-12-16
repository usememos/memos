package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type FindUserSetting struct {
	UserID *int32
	Key    storepb.UserSettingKey
}

func (s *Store) UpsertUserSetting(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	userSettingMessage, err := s.driver.UpsertUserSetting(ctx, upsert)
	if err != nil {
		return nil, err
	}

	s.userSettingCache.Store(getUserSettingV1CacheKey(userSettingMessage.UserId, userSettingMessage.Key.String()), userSettingMessage)
	return userSettingMessage, nil
}

func (s *Store) ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*storepb.UserSetting, error) {
	userSettingList, err := s.driver.ListUserSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	for _, userSetting := range userSettingList {
		s.userSettingCache.Store(getUserSettingV1CacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	}
	return userSettingList, nil
}

func (s *Store) GetUserSetting(ctx context.Context, find *FindUserSetting) (*storepb.UserSetting, error) {
	if find.UserID != nil {
		if cache, ok := s.userSettingCache.Load(getUserSettingV1CacheKey(*find.UserID, find.Key.String())); ok {
			return cache.(*storepb.UserSetting), nil
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
	s.userSettingCache.Store(getUserSettingV1CacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	return userSetting, nil
}

// GetUserAccessTokens returns the access tokens of the user.
func (s *Store) GetUserAccessTokens(ctx context.Context, userID int32) ([]*storepb.AccessTokensUserSetting_AccessToken, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
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

// RemoveUserAccessToken remove the access token of the user.
func (s *Store) RemoveUserAccessToken(ctx context.Context, userID int32, token string) error {
	oldAccessTokens, err := s.GetUserAccessTokens(ctx, userID)
	if err != nil {
		return err
	}

	newAccessTokens := make([]*storepb.AccessTokensUserSetting_AccessToken, 0, len(oldAccessTokens))
	for _, t := range oldAccessTokens {
		if token != t.AccessToken {
			newAccessTokens = append(newAccessTokens, t)
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: newAccessTokens,
			},
		},
	})

	return err
}

package store

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type UserSetting struct {
	UserID int32
	Key    storepb.UserSettingKey
	Value  string
}

type FindUserSetting struct {
	UserID *int32
	Key    storepb.UserSettingKey
}

func (s *Store) UpsertUserSetting(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error) {
	userSettingRaw, err := convertUserSettingToRaw(upsert)
	if err != nil {
		return nil, err
	}
	userSettingRaw, err = s.driver.UpsertUserSetting(ctx, userSettingRaw)
	if err != nil {
		return nil, err
	}

	userSetting, err := convertUserSettingFromRaw(userSettingRaw)
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return nil, errors.New("unexpected nil user setting")
	}
	s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	return userSetting, nil
}

func (s *Store) ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*storepb.UserSetting, error) {
	userSettingRawList, err := s.driver.ListUserSettings(ctx, find)
	if err != nil {
		return nil, err
	}

	userSettings := []*storepb.UserSetting{}
	for _, userSettingRaw := range userSettingRawList {
		userSetting, err := convertUserSettingFromRaw(userSettingRaw)
		if err != nil {
			return nil, err
		}
		if userSetting == nil {
			continue
		}
		s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
		userSettings = append(userSettings, userSetting)
	}
	return userSettings, nil
}

func (s *Store) GetUserSetting(ctx context.Context, find *FindUserSetting) (*storepb.UserSetting, error) {
	if find.UserID != nil {
		if cache, ok := s.userSettingCache.Load(getUserSettingCacheKey(*find.UserID, find.Key.String())); ok {
			userSetting, ok := cache.(*storepb.UserSetting)
			if ok {
				return userSetting, nil
			}
		}
	}

	list, err := s.ListUserSettings(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	if len(list) > 1 {
		return nil, errors.Errorf("expected 1 user setting, but got %d", len(list))
	}

	userSetting := list[0]
	s.userSettingCache.Store(getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	return userSetting, nil
}

// GetUserAccessTokens returns the access tokens of the user.
func (s *Store) GetUserAccessTokens(ctx context.Context, userID int32) ([]*storepb.AccessTokensUserSetting_AccessToken, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSettingKey_ACCESS_TOKENS,
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
		Key:    storepb.UserSettingKey_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: newAccessTokens,
			},
		},
	})

	return err
}

func convertUserSettingFromRaw(raw *UserSetting) (*storepb.UserSetting, error) {
	userSetting := &storepb.UserSetting{
		UserId: raw.UserID,
		Key:    raw.Key,
	}

	switch raw.Key {
	case storepb.UserSettingKey_ACCESS_TOKENS:
		accessTokensUserSetting := &storepb.AccessTokensUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), accessTokensUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_AccessTokens{AccessTokens: accessTokensUserSetting}
	case storepb.UserSettingKey_LOCALE:
		userSetting.Value = &storepb.UserSetting_Locale{Locale: raw.Value}
	case storepb.UserSettingKey_APPEARANCE:
		userSetting.Value = &storepb.UserSetting_Appearance{Appearance: raw.Value}
	case storepb.UserSettingKey_MEMO_VISIBILITY:
		userSetting.Value = &storepb.UserSetting_MemoVisibility{MemoVisibility: raw.Value}
	default:
		return nil, nil
	}
	return userSetting, nil
}

func convertUserSettingToRaw(userSetting *storepb.UserSetting) (*UserSetting, error) {
	raw := &UserSetting{
		UserID: userSetting.UserId,
		Key:    userSetting.Key,
	}

	switch userSetting.Key {
	case storepb.UserSettingKey_ACCESS_TOKENS:
		accessTokensUserSetting := userSetting.GetAccessTokens()
		value, err := protojson.Marshal(accessTokensUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSettingKey_LOCALE:
		raw.Value = userSetting.GetLocale()
	case storepb.UserSettingKey_APPEARANCE:
		raw.Value = userSetting.GetAppearance()
	case storepb.UserSettingKey_MEMO_VISIBILITY:
		raw.Value = userSetting.GetMemoVisibility()
	default:
		return nil, errors.Errorf("unsupported user setting key: %v", userSetting.Key)
	}
	return raw, nil
}

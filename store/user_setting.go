package store

import (
	"context"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type UserSetting struct {
	UserID int32
	Key    storepb.UserSetting_Key
	Value  string
}

type FindUserSetting struct {
	UserID *int32
	Key    storepb.UserSetting_Key
}

// RefreshTokenQueryResult contains the result of querying a refresh token.
type RefreshTokenQueryResult struct {
	UserID       int32
	RefreshToken *storepb.RefreshTokensUserSetting_RefreshToken
}

// PATQueryResult contains the result of querying a PAT by hash.
type PATQueryResult struct {
	UserID int32
	User   *User
	PAT    *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken
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
	s.userSettingCache.Set(ctx, getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
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
		s.userSettingCache.Set(ctx, getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
		userSettings = append(userSettings, userSetting)
	}
	return userSettings, nil
}

func (s *Store) GetUserSetting(ctx context.Context, find *FindUserSetting) (*storepb.UserSetting, error) {
	if find.UserID != nil {
		if cache, ok := s.userSettingCache.Get(ctx, getUserSettingCacheKey(*find.UserID, find.Key.String())); ok {
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
	s.userSettingCache.Set(ctx, getUserSettingCacheKey(userSetting.UserId, userSetting.Key.String()), userSetting)
	return userSetting, nil
}

// GetUserByPATHash finds a user by PAT hash.
func (s *Store) GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error) {
	result, err := s.driver.GetUserByPATHash(ctx, tokenHash)
	if err != nil {
		return nil, err
	}

	// Fetch user info
	user, err := s.GetUser(ctx, &FindUser{ID: &result.UserID})
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found for PAT")
	}
	result.User = user

	return result, nil
}

// GetUserRefreshTokens returns the refresh tokens of the user.
func (s *Store) GetUserRefreshTokens(ctx context.Context, userID int32) ([]*storepb.RefreshTokensUserSetting_RefreshToken, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return []*storepb.RefreshTokensUserSetting_RefreshToken{}, nil
	}
	return userSetting.GetRefreshTokens().RefreshTokens, nil
}

// AddUserRefreshToken adds a new refresh token for the user.
func (s *Store) AddUserRefreshToken(ctx context.Context, userID int32, token *storepb.RefreshTokensUserSetting_RefreshToken) error {
	tokens, err := s.GetUserRefreshTokens(ctx, userID)
	if err != nil {
		return err
	}

	tokens = append(tokens, token)

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
		Value: &storepb.UserSetting_RefreshTokens{
			RefreshTokens: &storepb.RefreshTokensUserSetting{
				RefreshTokens: tokens,
			},
		},
	})
	return err
}

// RemoveUserRefreshToken removes a refresh token from the user.
func (s *Store) RemoveUserRefreshToken(ctx context.Context, userID int32, tokenID string) error {
	existingTokens, err := s.GetUserRefreshTokens(ctx, userID)
	if err != nil {
		return err
	}

	newTokens := make([]*storepb.RefreshTokensUserSetting_RefreshToken, 0, len(existingTokens))
	for _, token := range existingTokens {
		if token.TokenId != tokenID {
			newTokens = append(newTokens, token)
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
		Value: &storepb.UserSetting_RefreshTokens{
			RefreshTokens: &storepb.RefreshTokensUserSetting{
				RefreshTokens: newTokens,
			},
		},
	})
	return err
}

// GetUserRefreshTokenByID returns a specific refresh token.
func (s *Store) GetUserRefreshTokenByID(ctx context.Context, userID int32, tokenID string) (*storepb.RefreshTokensUserSetting_RefreshToken, error) {
	tokens, err := s.GetUserRefreshTokens(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, token := range tokens {
		if token.TokenId == tokenID {
			return token, nil
		}
	}
	return nil, nil
}

// GetUserPersonalAccessTokens returns the PATs of the user.
func (s *Store) GetUserPersonalAccessTokens(ctx context.Context, userID int32) ([]*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return []*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{}, nil
	}
	return userSetting.GetPersonalAccessTokens().Tokens, nil
}

// AddUserPersonalAccessToken adds a new PAT for the user.
func (s *Store) AddUserPersonalAccessToken(ctx context.Context, userID int32, token *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken) error {
	tokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
	if err != nil {
		return err
	}

	tokens = append(tokens, token)

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
		Value: &storepb.UserSetting_PersonalAccessTokens{
			PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
				Tokens: tokens,
			},
		},
	})
	return err
}

// RemoveUserPersonalAccessToken removes a PAT from the user.
func (s *Store) RemoveUserPersonalAccessToken(ctx context.Context, userID int32, tokenID string) error {
	existingTokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
	if err != nil {
		return err
	}

	newTokens := make([]*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, 0, len(existingTokens))
	for _, token := range existingTokens {
		if token.TokenId != tokenID {
			newTokens = append(newTokens, token)
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
		Value: &storepb.UserSetting_PersonalAccessTokens{
			PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
				Tokens: newTokens,
			},
		},
	})
	return err
}

// UpdatePATLastUsed updates the last_used_at timestamp of a PAT.
func (s *Store) UpdatePATLastUsed(ctx context.Context, userID int32, tokenID string, lastUsed *timestamppb.Timestamp) error {
	tokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
	if err != nil {
		return err
	}

	for _, token := range tokens {
		if token.TokenId == tokenID {
			token.LastUsedAt = lastUsed
			break
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
		Value: &storepb.UserSetting_PersonalAccessTokens{
			PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
				Tokens: tokens,
			},
		},
	})
	return err
}

// GetUserWebhooks returns the webhooks of the user.
func (s *Store) GetUserWebhooks(ctx context.Context, userID int32) ([]*storepb.WebhooksUserSetting_Webhook, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_WEBHOOKS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return []*storepb.WebhooksUserSetting_Webhook{}, nil
	}

	webhooksUserSetting := userSetting.GetWebhooks()
	return webhooksUserSetting.Webhooks, nil
}

// AddUserWebhook adds a new webhook for the user.
func (s *Store) AddUserWebhook(ctx context.Context, userID int32, webhook *storepb.WebhooksUserSetting_Webhook) error {
	existingWebhooks, err := s.GetUserWebhooks(ctx, userID)
	if err != nil {
		return err
	}

	// Check if webhook already exists, update if it does
	var updatedWebhooks []*storepb.WebhooksUserSetting_Webhook
	webhookExists := false
	for _, existing := range existingWebhooks {
		if existing.Id == webhook.Id {
			updatedWebhooks = append(updatedWebhooks, webhook)
			webhookExists = true
		} else {
			updatedWebhooks = append(updatedWebhooks, existing)
		}
	}

	// If webhook doesn't exist, add it
	if !webhookExists {
		updatedWebhooks = append(updatedWebhooks, webhook)
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_WEBHOOKS,
		Value: &storepb.UserSetting_Webhooks{
			Webhooks: &storepb.WebhooksUserSetting{
				Webhooks: updatedWebhooks,
			},
		},
	})

	return err
}

// RemoveUserWebhook removes the webhook of the user.
func (s *Store) RemoveUserWebhook(ctx context.Context, userID int32, webhookID string) error {
	oldWebhooks, err := s.GetUserWebhooks(ctx, userID)
	if err != nil {
		return err
	}

	newWebhooks := make([]*storepb.WebhooksUserSetting_Webhook, 0, len(oldWebhooks))
	for _, webhook := range oldWebhooks {
		if webhookID != webhook.Id {
			newWebhooks = append(newWebhooks, webhook)
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_WEBHOOKS,
		Value: &storepb.UserSetting_Webhooks{
			Webhooks: &storepb.WebhooksUserSetting{
				Webhooks: newWebhooks,
			},
		},
	})

	return err
}

// UpdateUserWebhook updates an existing webhook for the user.
func (s *Store) UpdateUserWebhook(ctx context.Context, userID int32, webhook *storepb.WebhooksUserSetting_Webhook) error {
	webhooks, err := s.GetUserWebhooks(ctx, userID)
	if err != nil {
		return err
	}

	for i, existing := range webhooks {
		if existing.Id == webhook.Id {
			webhooks[i] = webhook
			break
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_WEBHOOKS,
		Value: &storepb.UserSetting_Webhooks{
			Webhooks: &storepb.WebhooksUserSetting{
				Webhooks: webhooks,
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
	case storepb.UserSetting_SHORTCUTS:
		shortcutsUserSetting := &storepb.ShortcutsUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), shortcutsUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_Shortcuts{Shortcuts: shortcutsUserSetting}
	case storepb.UserSetting_GENERAL:
		generalUserSetting := &storepb.GeneralUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), generalUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_General{General: generalUserSetting}
	case storepb.UserSetting_REFRESH_TOKENS:
		refreshTokensUserSetting := &storepb.RefreshTokensUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), refreshTokensUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_RefreshTokens{RefreshTokens: refreshTokensUserSetting}
	case storepb.UserSetting_PERSONAL_ACCESS_TOKENS:
		patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), patsUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_PersonalAccessTokens{PersonalAccessTokens: patsUserSetting}
	case storepb.UserSetting_WEBHOOKS:
		webhooksUserSetting := &storepb.WebhooksUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), webhooksUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_Webhooks{Webhooks: webhooksUserSetting}
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
	case storepb.UserSetting_SHORTCUTS:
		shortcutsUserSetting := userSetting.GetShortcuts()
		value, err := protojson.Marshal(shortcutsUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSetting_GENERAL:
		generalUserSetting := userSetting.GetGeneral()
		value, err := protojson.Marshal(generalUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSetting_REFRESH_TOKENS:
		refreshTokensUserSetting := userSetting.GetRefreshTokens()
		value, err := protojson.Marshal(refreshTokensUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSetting_PERSONAL_ACCESS_TOKENS:
		patsUserSetting := userSetting.GetPersonalAccessTokens()
		value, err := protojson.Marshal(patsUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSetting_WEBHOOKS:
		webhooksUserSetting := userSetting.GetWebhooks()
		value, err := protojson.Marshal(webhooksUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	default:
		return nil, errors.Errorf("unsupported user setting key: %v", userSetting.Key)
	}
	return raw, nil
}

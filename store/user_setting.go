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

// GetUserAccessTokens returns the access tokens of the user.
func (s *Store) GetUserAccessTokens(ctx context.Context, userID int32) ([]*storepb.AccessTokensUserSetting_AccessToken, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_ACCESS_TOKENS,
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
		Key:    storepb.UserSetting_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: newAccessTokens,
			},
		},
	})

	return err
}

// GetUserSessions returns the sessions of the user.
func (s *Store) GetUserSessions(ctx context.Context, userID int32) ([]*storepb.SessionsUserSetting_Session, error) {
	userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SESSIONS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return []*storepb.SessionsUserSetting_Session{}, nil
	}

	sessionsUserSetting := userSetting.GetSessions()
	return sessionsUserSetting.Sessions, nil
}

// RemoveUserSession removes the session of the user.
func (s *Store) RemoveUserSession(ctx context.Context, userID int32, sessionID string) error {
	oldSessions, err := s.GetUserSessions(ctx, userID)
	if err != nil {
		return err
	}

	newSessions := make([]*storepb.SessionsUserSetting_Session, 0, len(oldSessions))
	for _, session := range oldSessions {
		if sessionID != session.SessionId {
			newSessions = append(newSessions, session)
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_SESSIONS,
		Value: &storepb.UserSetting_Sessions{
			Sessions: &storepb.SessionsUserSetting{
				Sessions: newSessions,
			},
		},
	})

	return err
}

// AddUserSession adds a new session for the user.
func (s *Store) AddUserSession(ctx context.Context, userID int32, session *storepb.SessionsUserSetting_Session) error {
	existingSessions, err := s.GetUserSessions(ctx, userID)
	if err != nil {
		return err
	}

	// Check if session already exists, update if it does
	var updatedSessions []*storepb.SessionsUserSetting_Session
	sessionExists := false
	for _, existing := range existingSessions {
		if existing.SessionId == session.SessionId {
			updatedSessions = append(updatedSessions, session)
			sessionExists = true
		} else {
			updatedSessions = append(updatedSessions, existing)
		}
	}

	// If session doesn't exist, add it
	if !sessionExists {
		updatedSessions = append(updatedSessions, session)
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_SESSIONS,
		Value: &storepb.UserSetting_Sessions{
			Sessions: &storepb.SessionsUserSetting{
				Sessions: updatedSessions,
			},
		},
	})

	return err
}

// UpdateUserSessionLastAccessed updates the last accessed time of a session.
func (s *Store) UpdateUserSessionLastAccessed(ctx context.Context, userID int32, sessionID string, lastAccessedTime *timestamppb.Timestamp) error {
	sessions, err := s.GetUserSessions(ctx, userID)
	if err != nil {
		return err
	}

	for _, session := range sessions {
		if session.SessionId == sessionID {
			session.LastAccessedTime = lastAccessedTime
			break
		}
	}

	_, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: userID,
		Key:    storepb.UserSetting_SESSIONS,
		Value: &storepb.UserSetting_Sessions{
			Sessions: &storepb.SessionsUserSetting{
				Sessions: sessions,
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
	case storepb.UserSetting_ACCESS_TOKENS:
		accessTokensUserSetting := &storepb.AccessTokensUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), accessTokensUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_AccessTokens{AccessTokens: accessTokensUserSetting}
	case storepb.UserSetting_SESSIONS:
		sessionsUserSetting := &storepb.SessionsUserSetting{}
		if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), sessionsUserSetting); err != nil {
			return nil, err
		}
		userSetting.Value = &storepb.UserSetting_Sessions{Sessions: sessionsUserSetting}
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
	case storepb.UserSetting_ACCESS_TOKENS:
		accessTokensUserSetting := userSetting.GetAccessTokens()
		value, err := protojson.Marshal(accessTokensUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
	case storepb.UserSetting_SESSIONS:
		sessionsUserSetting := userSetting.GetSessions()
		value, err := protojson.Marshal(sessionsUserSetting)
		if err != nil {
			return nil, err
		}
		raw.Value = string(value)
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

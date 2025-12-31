package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestUserSettingStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}},
	})
	require.NoError(t, err)
	list, err := ts.ListUserSettings(ctx, &store.FindUserSetting{})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	ts.Close()
}

func TestUserSettingGetByUserID(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "zh"}},
	})
	require.NoError(t, err)

	// Get by user ID
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Equal(t, "zh", setting.GetGeneral().Locale)

	// Get non-existent key
	nonExistentSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	require.NoError(t, err)
	require.Nil(t, nonExistentSetting)

	ts.Close()
}

func TestUserSettingUpsertUpdate(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create initial setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}},
	})
	require.NoError(t, err)

	// Update setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "fr"}},
	})
	require.NoError(t, err)

	// Verify update
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_GENERAL,
	})
	require.NoError(t, err)
	require.Equal(t, "fr", setting.GetGeneral().Locale)

	// Verify only one setting exists
	list, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &user.ID})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))

	ts.Close()
}

func TestUserSettingRefreshTokens(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no tokens
	tokens, err := ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, tokens)

	// Add a refresh token
	token1 := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:     "token-1",
		Description: "Chrome browser session",
	}
	err = ts.AddUserRefreshToken(ctx, user.ID, token1)
	require.NoError(t, err)

	// Verify token was added
	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	require.Equal(t, "token-1", tokens[0].TokenId)

	// Add another token
	token2 := &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:     "token-2",
		Description: "Firefox browser session",
	}
	err = ts.AddUserRefreshToken(ctx, user.ID, token2)
	require.NoError(t, err)

	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 2)

	// Get specific token by ID
	foundToken, err := ts.GetUserRefreshTokenByID(ctx, user.ID, "token-1")
	require.NoError(t, err)
	require.NotNil(t, foundToken)
	require.Equal(t, "Chrome browser session", foundToken.Description)

	// Get non-existent token
	notFound, err := ts.GetUserRefreshTokenByID(ctx, user.ID, "non-existent")
	require.NoError(t, err)
	require.Nil(t, notFound)

	// Remove token
	err = ts.RemoveUserRefreshToken(ctx, user.ID, "token-1")
	require.NoError(t, err)

	tokens, err = ts.GetUserRefreshTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	require.Equal(t, "token-2", tokens[0].TokenId)

	ts.Close()
}

func TestUserSettingPersonalAccessTokens(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no PATs
	pats, err := ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, pats)

	// Add a PAT
	pat1 := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-1",
		TokenHash:   "pat-hash-1",
		Description: "API Token for external access",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat1)
	require.NoError(t, err)

	// Verify PAT was added
	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.Equal(t, "API Token for external access", pats[0].Description)

	// Add another PAT
	pat2 := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-2",
		TokenHash:   "pat-hash-2",
		Description: "CI Token",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat2)
	require.NoError(t, err)

	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 2)

	// Remove PAT
	err = ts.RemoveUserPersonalAccessToken(ctx, user.ID, "pat-1")
	require.NoError(t, err)

	pats, err = ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.Equal(t, "pat-2", pats[0].TokenId)

	ts.Close()
}

func TestUserSettingWebhooks(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no webhooks
	webhooks, err := ts.GetUserWebhooks(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, webhooks)

	// Add a webhook
	webhook1 := &storepb.WebhooksUserSetting_Webhook{
		Id:    "webhook-1",
		Title: "Deploy Hook",
		Url:   "https://example.com/webhook",
	}
	err = ts.AddUserWebhook(ctx, user.ID, webhook1)
	require.NoError(t, err)

	// Verify webhook was added
	webhooks, err = ts.GetUserWebhooks(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, webhooks, 1)
	require.Equal(t, "Deploy Hook", webhooks[0].Title)

	// Update webhook
	webhook1Updated := &storepb.WebhooksUserSetting_Webhook{
		Id:    "webhook-1",
		Title: "Updated Deploy Hook",
		Url:   "https://example.com/webhook/v2",
	}
	err = ts.UpdateUserWebhook(ctx, user.ID, webhook1Updated)
	require.NoError(t, err)

	webhooks, err = ts.GetUserWebhooks(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, webhooks, 1)
	require.Equal(t, "Updated Deploy Hook", webhooks[0].Title)
	require.Equal(t, "https://example.com/webhook/v2", webhooks[0].Url)

	// Add another webhook
	webhook2 := &storepb.WebhooksUserSetting_Webhook{
		Id:    "webhook-2",
		Title: "Notification Hook",
		Url:   "https://slack.example.com/webhook",
	}
	err = ts.AddUserWebhook(ctx, user.ID, webhook2)
	require.NoError(t, err)

	webhooks, err = ts.GetUserWebhooks(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, webhooks, 2)

	// Remove webhook
	err = ts.RemoveUserWebhook(ctx, user.ID, "webhook-1")
	require.NoError(t, err)

	webhooks, err = ts.GetUserWebhooks(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, webhooks, 1)
	require.Equal(t, "webhook-2", webhooks[0].Id)

	ts.Close()
}

func TestUserSettingShortcuts(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create shortcuts setting
	shortcuts := &storepb.ShortcutsUserSetting{
		Shortcuts: []*storepb.ShortcutsUserSetting_Shortcut{
			{Id: "shortcut-1", Title: "Work Notes", Filter: "tag:work"},
			{Id: "shortcut-2", Title: "Personal", Filter: "tag:personal"},
		},
	}
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_SHORTCUTS,
		Value:  &storepb.UserSetting_Shortcuts{Shortcuts: shortcuts},
	})
	require.NoError(t, err)

	// Retrieve and verify
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &user.ID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Len(t, setting.GetShortcuts().Shortcuts, 2)
	require.Equal(t, "Work Notes", setting.GetShortcuts().Shortcuts[0].Title)

	ts.Close()
}

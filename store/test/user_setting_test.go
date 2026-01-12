package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

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

func TestUserSettingGetUserByPATHash(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT with a known hash
	patHash := "test-pat-hash-12345"
	pat := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-test-1",
		TokenHash:   patHash,
		Description: "Test PAT for lookup",
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat)
	require.NoError(t, err)

	// Lookup user by PAT hash
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user.ID, result.UserID)
	require.NotNil(t, result.User)
	require.Equal(t, user.Username, result.User.Username)
	require.NotNil(t, result.PAT)
	require.Equal(t, "pat-test-1", result.PAT.TokenId)
	require.Equal(t, "Test PAT for lookup", result.PAT.Description)

	ts.Close()
}

func TestUserSettingGetUserByPATHashNotFound(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Lookup non-existent PAT hash
	result, err := ts.GetUserByPATHash(ctx, "non-existent-hash")
	require.Error(t, err)
	require.Nil(t, result)

	ts.Close()
}

func TestUserSettingGetUserByPATHashMultipleUsers(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create PATs for both users
	pat1Hash := "user1-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user1.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-user1",
		TokenHash:   pat1Hash,
		Description: "User 1 PAT",
	})
	require.NoError(t, err)

	pat2Hash := "user2-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user2.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-user2",
		TokenHash:   pat2Hash,
		Description: "User 2 PAT",
	})
	require.NoError(t, err)

	// Lookup user1's PAT
	result1, err := ts.GetUserByPATHash(ctx, pat1Hash)
	require.NoError(t, err)
	require.Equal(t, user1.ID, result1.UserID)
	require.Equal(t, user1.Username, result1.User.Username)

	// Lookup user2's PAT
	result2, err := ts.GetUserByPATHash(ctx, pat2Hash)
	require.NoError(t, err)
	require.Equal(t, user2.ID, result2.UserID)
	require.Equal(t, user2.Username, result2.User.Username)

	ts.Close()
}

func TestUserSettingGetUserByPATHashMultiplePATsSameUser(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create multiple PATs for the same user
	pat1Hash := "first-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-1",
		TokenHash:   pat1Hash,
		Description: "First PAT",
	})
	require.NoError(t, err)

	pat2Hash := "second-pat-hash"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-2",
		TokenHash:   pat2Hash,
		Description: "Second PAT",
	})
	require.NoError(t, err)

	// Both PATs should resolve to the same user
	result1, err := ts.GetUserByPATHash(ctx, pat1Hash)
	require.NoError(t, err)
	require.Equal(t, user.ID, result1.UserID)
	require.Equal(t, "pat-1", result1.PAT.TokenId)

	result2, err := ts.GetUserByPATHash(ctx, pat2Hash)
	require.NoError(t, err)
	require.Equal(t, user.ID, result2.UserID)
	require.Equal(t, "pat-2", result2.PAT.TokenId)

	ts.Close()
}

func TestUserSettingUpdatePATLastUsed(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT
	patHash := "pat-hash-for-update"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-update-test",
		TokenHash:   patHash,
		Description: "PAT for update test",
	})
	require.NoError(t, err)

	// Update last used timestamp
	now := timestamppb.Now()
	err = ts.UpdatePATLastUsed(ctx, user.ID, "pat-update-test", now)
	require.NoError(t, err)

	// Verify the update
	pats, err := ts.GetUserPersonalAccessTokens(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, pats, 1)
	require.NotNil(t, pats[0].LastUsedAt)

	ts.Close()
}

func TestUserSettingGetUserByPATHashWithExpiredToken(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT with expiration info
	patHash := "pat-hash-with-expiry"
	expiresAt := timestamppb.Now()
	pat := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-expiry-test",
		TokenHash:   patHash,
		Description: "PAT with expiry",
		ExpiresAt:   expiresAt,
	}
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, pat)
	require.NoError(t, err)

	// Should still be able to look up by hash (expiry check is done at auth level)
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, user.ID, result.UserID)
	require.NotNil(t, result.PAT.ExpiresAt)

	ts.Close()
}

func TestUserSettingGetUserByPATHashAfterRemoval(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a PAT
	patHash := "pat-hash-to-remove"
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     "pat-remove-test",
		TokenHash:   patHash,
		Description: "PAT to be removed",
	})
	require.NoError(t, err)

	// Verify it exists
	result, err := ts.GetUserByPATHash(ctx, patHash)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Remove the PAT
	err = ts.RemoveUserPersonalAccessToken(ctx, user.ID, "pat-remove-test")
	require.NoError(t, err)

	// Should no longer be found
	result, err = ts.GetUserByPATHash(ctx, patHash)
	require.Error(t, err)
	require.Nil(t, result)

	ts.Close()
}

func TestUserSettingGetUserByPATHashSpecialCharacters(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create PATs with special characters in hash (simulating real hash values)
	testCases := []struct {
		tokenID   string
		tokenHash string
	}{
		{"pat-special-1", "abc123+/=XYZ"},
		{"pat-special-2", "sha256:abcdef1234567890"},
		{"pat-special-3", "$2a$10$N9qo8uLOickgx2ZMRZoMy"},
	}

	for _, tc := range testCases {
		err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
			TokenId:     tc.tokenID,
			TokenHash:   tc.tokenHash,
			Description: "PAT with special chars",
		})
		require.NoError(t, err)

		// Verify lookup works with special characters
		result, err := ts.GetUserByPATHash(ctx, tc.tokenHash)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, tc.tokenID, result.PAT.TokenId)
	}

	ts.Close()
}

func TestUserSettingGetUserByPATHashLargeTokenCount(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create many PATs for the same user
	tokenCount := 10
	hashes := make([]string, tokenCount)
	for i := 0; i < tokenCount; i++ {
		hashes[i] = "pat-hash-" + string(rune('A'+i)) + "-large-test"
		err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
			TokenId:     "pat-large-" + string(rune('A'+i)),
			TokenHash:   hashes[i],
			Description: "PAT for large count test",
		})
		require.NoError(t, err)
	}

	// Verify each hash can be looked up
	for i, hash := range hashes {
		result, err := ts.GetUserByPATHash(ctx, hash)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Equal(t, user.ID, result.UserID)
		require.Equal(t, "pat-large-"+string(rune('A'+i)), result.PAT.TokenId)
	}

	ts.Close()
}

func TestUserSettingMultipleSettingTypes(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create GENERAL setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value:  &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "ja"}},
	})
	require.NoError(t, err)

	// Create SHORTCUTS setting
	_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_SHORTCUTS,
		Value: &storepb.UserSetting_Shortcuts{Shortcuts: &storepb.ShortcutsUserSetting{
			Shortcuts: []*storepb.ShortcutsUserSetting_Shortcut{
				{Id: "s1", Title: "Shortcut 1"},
			},
		}},
	})
	require.NoError(t, err)

	// Add a PAT
	err = ts.AddUserPersonalAccessToken(ctx, user.ID, &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:   "pat-multi",
		TokenHash: "hash-multi",
	})
	require.NoError(t, err)

	// List all settings for user
	settings, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &user.ID})
	require.NoError(t, err)
	require.Len(t, settings, 3)

	// Verify each setting type
	generalSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &user.ID, Key: storepb.UserSetting_GENERAL})
	require.NoError(t, err)
	require.Equal(t, "ja", generalSetting.GetGeneral().Locale)

	shortcutsSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &user.ID, Key: storepb.UserSetting_SHORTCUTS})
	require.NoError(t, err)
	require.Len(t, shortcutsSetting.GetShortcuts().Shortcuts, 1)

	patsSetting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &user.ID, Key: storepb.UserSetting_PERSONAL_ACCESS_TOKENS})
	require.NoError(t, err)
	require.Len(t, patsSetting.GetPersonalAccessTokens().Tokens, 1)

	ts.Close()
}

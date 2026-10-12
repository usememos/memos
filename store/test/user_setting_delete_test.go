package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestDeleteUserSettingsInvalidatesOnlyMatchingCacheEntries(t *testing.T) {
	for _, name := range []string{"one key", "all user keys", "key across users", "all settings", "missing user", "missing key"} {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			owner, err := createTestingUserWithRole(ctx, ts, "settings-owner", store.RoleUser)
			require.NoError(t, err)
			peer, err := createTestingUserWithRole(ctx, ts, "settings-peer", store.RoleUser)
			require.NoError(t, err)
			var settings []*storepb.UserSetting
			for _, user := range []*store.User{owner, peer} {
				settings = append(settings,
					&storepb.UserSetting{UserId: user.ID, Key: storepb.UserSetting_GENERAL,
						Value: &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: user.Username}}},
					&storepb.UserSetting{UserId: user.ID, Key: storepb.UserSetting_MEMO_VIEWS,
						Value: &storepb.UserSetting_MemoViews{MemoViews: &storepb.MemoViewsUserSetting{
							MemoViews: []*storepb.MemoViewsUserSetting_MemoView{{Id: "saved", Title: user.Username}},
						}}})
			}
			for _, setting := range settings {
				_, err := ts.UpsertUserSetting(ctx, setting)
				require.NoError(t, err)
				cached, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &setting.UserId, Key: setting.Key})
				require.NoError(t, err)
				require.True(t, proto.Equal(setting, cached))
			}
			delete := &store.DeleteUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_GENERAL}
			switch name {
			case "all user keys":
				delete.Key = storepb.UserSetting_KEY_UNSPECIFIED
			case "key across users":
				delete.UserID = nil
			case "all settings":
				delete = &store.DeleteUserSetting{}
			case "missing user":
				delete.UserID = new(int32(99999))
			case "missing key":
				delete.Key = storepb.UserSetting_WEBHOOKS
			default:
			}
			for range 2 { // Repeated deletion must remain harmless.
				require.NoError(t, ts.DeleteUserSettings(ctx, delete))
				var expected []*storepb.UserSetting
				for _, setting := range settings {
					got, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &setting.UserId, Key: setting.Key})
					require.NoError(t, err)
					matches := (delete.UserID == nil || *delete.UserID == setting.UserId) &&
						(delete.Key == storepb.UserSetting_KEY_UNSPECIFIED || delete.Key == setting.Key)
					if matches {
						require.Nil(t, got, "deleted setting must not survive in cache")
					} else {
						require.True(t, proto.Equal(setting, got), "unrelated setting changed")
						expected = append(expected, setting)
					}
				}
				persisted, err := ts.ListUserSettings(ctx, &store.FindUserSetting{})
				require.NoError(t, err)
				require.Len(t, persisted, len(expected))
				for _, want := range expected {
					require.Condition(t, func() bool {
						for _, got := range persisted {
							if proto.Equal(want, got) {
								return true
							}
						}
						return false
					})
				}
			}
			// Recreating a deleted key must be visible immediately, including after a cached miss.
			_, err = ts.UpsertUserSetting(ctx, &storepb.UserSetting{UserId: owner.ID, Key: storepb.UserSetting_GENERAL,
				Value: &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "new"}}})
			require.NoError(t, err)
			got, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &owner.ID, Key: storepb.UserSetting_GENERAL})
			require.NoError(t, err)
			require.Equal(t, "new", got.GetGeneral().GetLocale())
		})
	}
}

func TestDeleteUserSettingsFailurePreservesDataAndCache(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	setting, err := ts.UpsertUserSetting(ctx, &storepb.UserSetting{UserId: user.ID, Key: storepb.UserSetting_GENERAL,
		Value: &storepb.UserSetting_General{General: &storepb.GeneralUserSetting{Locale: "en"}}})
	require.NoError(t, err)
	removeTrigger := rejectStoreDelete(t, ts, "user_setting")
	require.ErrorContains(t, ts.DeleteUserSettings(ctx, &store.DeleteUserSetting{UserID: &user.ID}), "store test delete failure")
	cached, err := ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &user.ID, Key: setting.Key})
	require.NoError(t, err)
	require.True(t, proto.Equal(setting, cached))
	persisted, err := ts.ListUserSettings(ctx, &store.FindUserSetting{UserID: &user.ID})
	require.NoError(t, err)
	require.Len(t, persisted, 1)
	require.True(t, proto.Equal(setting, persisted[0]))
	removeTrigger()
	require.NoError(t, ts.DeleteUserSettings(ctx, &store.DeleteUserSetting{UserID: &user.ID}))
	cached, err = ts.GetUserSetting(ctx, &store.FindUserSetting{UserID: &user.ID, Key: setting.Key})
	require.NoError(t, err)
	require.Nil(t, cached)
}

package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1server "github.com/usememos/memos/server/router/api/v1"
)

func TestListUserSettingsOmitsInternalStoreSettings(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "locale-user")
	require.NoError(t, err)

	_, err = ts.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_REFRESH_TOKENS,
		Value: &storepb.UserSetting_RefreshTokens{
			RefreshTokens: &storepb.RefreshTokensUserSetting{},
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_SHORTCUTS,
		Value: &storepb.UserSetting_Shortcuts{
			Shortcuts: &storepb.ShortcutsUserSetting{},
		},
	})
	require.NoError(t, err)

	_, err = ts.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSetting_GENERAL,
		Value: &storepb.UserSetting_General{
			General: &storepb.GeneralUserSetting{
				Locale: "ja",
			},
		},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserSettings(ts.CreateUserContext(ctx, user.ID), &apiv1.ListUserSettingsRequest{
		Parent: apiv1server.BuildUserName(user.Username),
	})
	require.NoError(t, err)
	require.Len(t, resp.Settings, 1)
	require.Equal(t, "users/locale-user/settings/GENERAL", resp.Settings[0].Name)
	require.Equal(t, "ja", resp.Settings[0].GetGeneralSetting().Locale)
}

package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestUserSettingStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	testSetting, err := ts.UpsertUserSetting(ctx, &store.UserSetting{
		UserID: user.ID,
		Key:    "test_key",
		Value:  "test_value",
	})
	require.NoError(t, err)
	localeSetting, err := ts.UpsertUserSetting(ctx, &store.UserSetting{
		UserID: user.ID,
		Key:    "locale",
		Value:  "zh",
	})
	require.NoError(t, err)
	list, err := ts.ListUserSettings(ctx, &store.FindUserSetting{})
	require.NoError(t, err)
	require.Equal(t, 2, len(list))
	require.Equal(t, testSetting, list[0])
	require.Equal(t, localeSetting, list[1])
}

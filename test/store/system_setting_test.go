package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/store"
)

func TestSystemSettingStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := ts.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingServerIDName,
		Value: "test_server_id",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingSecretSessionName,
		Value: "test_secret_session_name",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingAllowSignUpName,
		Value: "true",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingLocalStoragePathName,
		Value: "/tmp/memos",
	})
	require.NoError(t, err)
	list, err := ts.ListSystemSettings(ctx, &store.FindSystemSetting{})
	require.NoError(t, err)
	require.Equal(t, 4, len(list))
}

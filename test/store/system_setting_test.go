package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/api"
)

func TestSystemSettingStore(t *testing.T) {
	ctx := context.Background()
	store := NewTestingStore(ctx, t)
	_, err := store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingServerIDName,
		Value: "test_server_id",
	})
	require.NoError(t, err)
	_, err = store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingSecretSessionName,
		Value: "test_secret_session_name",
	})
	require.NoError(t, err)
	_, err = store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingAllowSignUpName,
		Value: "true",
	})
	require.NoError(t, err)
	_, err = store.UpsertSystemSetting(ctx, &api.SystemSettingUpsert{
		Name:  api.SystemSettingLocalStoragePathName,
		Value: "/tmp/memos",
	})
	require.NoError(t, err)
}

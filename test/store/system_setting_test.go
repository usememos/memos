package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/store"
)

func TestSystemSettingStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := ts.UpsertSystemSetting(ctx, &store.SystemSetting{
		Name:  apiv1.SystemSettingServerIDName.String(),
		Value: "test_server_id",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &store.SystemSetting{
		Name:  apiv1.SystemSettingSecretSessionName.String(),
		Value: "test_secret_session_name",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &store.SystemSetting{
		Name:  apiv1.SystemSettingAllowSignUpName.String(),
		Value: "true",
	})
	require.NoError(t, err)
	_, err = ts.UpsertSystemSetting(ctx, &store.SystemSetting{
		Name:  apiv1.SystemSettingLocalStoragePathName.String(),
		Value: "/tmp/memos",
	})
	require.NoError(t, err)
	list, err := ts.ListSystemSettings(ctx, &store.FindSystemSetting{})
	require.NoError(t, err)
	require.Equal(t, 4, len(list))
}

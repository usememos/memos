package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestWorkspaceSettingStore(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := ts.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
		Name:  apiv1.SystemSettingServerIDName.String(),
		Value: "test_server_id",
	})
	require.NoError(t, err)
	_, err = ts.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
		Name:  apiv1.SystemSettingSecretSessionName.String(),
		Value: "test_secret_session_name",
	})
	require.NoError(t, err)
	_, err = ts.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
		Name:  apiv1.SystemSettingAllowSignUpName.String(),
		Value: "true",
	})
	require.NoError(t, err)
	_, err = ts.UpsertWorkspaceSetting(ctx, &store.WorkspaceSetting{
		Name:  apiv1.SystemSettingLocalStoragePathName.String(),
		Value: "/tmp/memos",
	})
	require.NoError(t, err)
	list, err := ts.ListWorkspaceSettings(ctx, &store.FindWorkspaceSetting{})
	require.NoError(t, err)
	require.Equal(t, 4, len(list))
	ts.Close()
}

func TestWorkspaceSettingV1Store(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	workspaceSetting, err := ts.UpsertWorkspaceSettingV1(ctx, &storepb.WorkspaceSetting{
		Key: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL,
		Value: &storepb.WorkspaceSetting_General{
			General: &storepb.WorkspaceGeneralSetting{
				DisallowSignup: true,
			},
		},
	})
	require.NoError(t, err)
	list, err := ts.ListWorkspaceSettingsV1(ctx, &store.FindWorkspaceSettingV1{})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	require.Equal(t, workspaceSetting, list[0])
	ts.Close()
}

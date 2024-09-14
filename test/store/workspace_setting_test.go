package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestWorkspaceSettingV1Store(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	workspaceSetting, err := ts.UpsertWorkspaceSetting(ctx, &storepb.WorkspaceSetting{
		Key: storepb.WorkspaceSettingKey_GENERAL,
		Value: &storepb.WorkspaceSetting_GeneralSetting{
			GeneralSetting: &storepb.WorkspaceGeneralSetting{
				AdditionalScript: "",
			},
		},
	})
	require.NoError(t, err)
	setting, err := ts.GetWorkspaceSetting(ctx, &store.FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_GENERAL.String(),
	})
	require.NoError(t, err)
	require.Equal(t, workspaceSetting, setting)
	ts.Close()
}

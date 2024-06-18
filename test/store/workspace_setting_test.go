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
	list, err := ts.ListWorkspaceSettings(ctx, &store.FindWorkspaceSetting{})
	require.NoError(t, err)
	require.Equal(t, 1, len(list))
	require.Equal(t, workspaceSetting, list[0])
	ts.Close()
}

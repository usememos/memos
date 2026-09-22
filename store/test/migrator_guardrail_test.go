package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// setSchemaVersion overwrites the recorded schema version so upgrade guard rails
// can be exercised without fabricating a whole legacy database.
func setSchemaVersion(ctx context.Context, t *testing.T, ts *store.Store, schemaVersion string) {
	t.Helper()

	basicSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)

	basicSetting.SchemaVersion = schemaVersion
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: basicSetting},
	})
	require.NoError(t, err)

	stored, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, schemaVersion, stored.SchemaVersion, "schema version should be persisted")
}

// TestMigrationRejectsUnsupportedSchema verifies rejected startup leaves data
// and settings unchanged, including an ACCESS setting that would otherwise be created.
func TestMigrationRejectsUnsupportedSchema(t *testing.T) {
	for _, tc := range []struct {
		name, schema, message string
		missingBasic          bool
	}{
		{name: "pre-v0.22", schema: "0.21.0", message: "First upgrade to v0.25.3"},
		{name: "v0.22", schema: "0.22.0", message: "First upgrade to v0.31.0"},
		{name: "v0.30", schema: "0.30.1", message: "First upgrade to v0.31.0"},
		{name: "before-baseline", schema: "0.31.7", message: "First upgrade to v0.31.0"},
		{name: "empty", schema: "", message: "First upgrade to v0.25.3"},
		{name: "zero", schema: "0.0.0", message: "First upgrade to v0.25.3"},
		{name: "missing-basic", missingBasic: true, message: "First upgrade to v0.25.3"},
		{name: "invalid-month", schema: "26.13.1", message: "invalid database schema version"},
		{name: "calver-newer", schema: "26.9.1", message: "cannot downgrade schema version"},
		{name: "invalid", schema: "unknown", message: "invalid database schema version"},
		{name: "incomplete", schema: "0.31", message: "invalid database schema version"},
		{name: "prerelease", schema: "0.31.8-rc.1", message: "invalid database schema version"},
		{name: "build-metadata", schema: "0.31.8+build", message: "invalid database schema version"},
		{name: "newer", schema: "99.1.1", message: "cannot downgrade schema version"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			user, err := createTestingHostUser(ctx, ts)
			require.NoError(t, err)
			memo, err := ts.CreateMemo(ctx, &store.Memo{
				UID: "preserved-memo", CreatorID: user.ID, Content: "preserve on rejected startup", Visibility: store.Private,
			})
			require.NoError(t, err)
			memo, err = ts.GetMemo(ctx, &store.FindMemo{UID: &memo.UID})
			require.NoError(t, err)
			if tc.missingBasic {
				require.NoError(t, ts.DeleteInstanceSetting(ctx, &store.DeleteInstanceSetting{Name: "BASIC"}))
			} else {
				setSchemaVersion(ctx, t, ts, tc.schema)
			}
			require.NoError(t, ts.DeleteInstanceSetting(ctx, &store.DeleteInstanceSetting{Name: "ACCESS"}))
			before, err := ts.GetDriver().ListInstanceSettings(ctx, &store.FindInstanceSetting{})
			require.NoError(t, err)

			require.ErrorContains(t, ts.Migrate(ctx), tc.message)

			after, err := ts.GetDriver().ListInstanceSettings(ctx, &store.FindInstanceSetting{})
			require.NoError(t, err)
			require.ElementsMatch(t, before, after, "rejected startup must not write settings")
			preserved, err := ts.GetMemo(ctx, &store.FindMemo{UID: &memo.UID})
			require.NoError(t, err)
			require.Equal(t, memo, preserved)
		})
	}
}

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

// TestMigrationRejectsDowngrade verifies a database written by a newer Memos is
// refused rather than silently re-migrated. Starting an old binary against a
// newer database is the most common way a rollback corrupts data.
func TestMigrationRejectsDowngrade(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	currentVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)

	// Pretend the database was written by a much newer release.
	setSchemaVersion(ctx, t, ts, "99.0.0")

	err = ts.Migrate(ctx)
	require.Error(t, err, "migrating a newer database should fail")
	require.Contains(t, err.Error(), "cannot downgrade schema version",
		"error should explain the downgrade was refused")
	require.Contains(t, err.Error(), currentVersion,
		"error should name the version the binary supports")
}

// TestMigrationRejectsPreV022Installation verifies installations older than the
// supported floor are refused with actionable upgrade instructions instead of
// failing partway through a migration.
func TestMigrationRejectsPreV022Installation(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// 0.21.x predates moving schema tracking from migration_history to system_setting.
	setSchemaVersion(ctx, t, ts, "0.21.0")

	err := ts.Migrate(ctx)
	require.Error(t, err, "migrating a pre-0.22 installation should fail")
	require.Contains(t, err.Error(), "too old to upgrade directly")
	require.Contains(t, err.Error(), "0.25.3",
		"error should name the intermediate version to upgrade through")
}

// TestMigrationAcceptsMinimumSupportedVersion pins the other side of the
// supported-version boundary: 0.22.0 must clear the floor check that rejects
// 0.21.x.
//
// This asserts only that the floor check passes, not that the whole migration
// succeeds. The store here has a current schema relabelled as 0.22.0, so
// replaying the 0.22-onward migrations against it legitimately fails on tables
// that were since renamed. Verifying a real 0.22 replay needs a genuine 0.22
// database, which is the container tier's job.
func TestMigrationAcceptsMinimumSupportedVersion(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	setSchemaVersion(ctx, t, ts, "0.22.0")

	if err := ts.Migrate(ctx); err != nil {
		require.NotContains(t, err.Error(), "too old to upgrade directly",
			"0.22.0 is the supported floor and must clear the minimum-version check")
	}
}

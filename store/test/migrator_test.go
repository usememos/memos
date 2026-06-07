package test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestFreshInstall verifies that LATEST.sql applies correctly on a fresh database.
// This is essentially what NewTestingStore already does, but we make it explicit.
func TestFreshInstall(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	// NewTestingStore creates a fresh database and runs Migrate()
	// which applies LATEST.sql for uninitialized databases
	ts := NewTestingStore(ctx, t)

	// Verify migration completed successfully
	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.NotEmpty(t, currentSchemaVersion, "schema version should be set after fresh install")

	// Verify we can read instance settings (basic sanity check)
	instanceSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, instanceSetting.SchemaVersion)
}

// TestMigrationReRun verifies that re-running the migration on an already
// migrated database does not fail or cause issues. This simulates a
// scenario where the server is restarted.
func TestMigrationReRun(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	// Use the shared testing store which already runs migrations on init
	ts := NewTestingStore(ctx, t)

	// Get current version
	initialVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)

	// Manually trigger migration again
	err = ts.Migrate(ctx)
	require.NoError(t, err, "re-running migration should not fail")

	// Verify version hasn't changed (or at least is valid)
	finalVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, initialVersion, finalVersion, "version should match after re-run")
}

// TestMigrationWithData verifies that migration preserves data integrity.
// Creates data, then re-runs migration and verifies data is still accessible.
func TestMigrationWithData(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create a user and memo before re-running migration
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err, "should create user")

	originalMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "migration-data-test",
		CreatorID:  user.ID,
		Content:    "Data before migration re-run",
		Visibility: store.Public,
	})
	require.NoError(t, err, "should create memo")

	// Re-run migration
	err = ts.Migrate(ctx)
	require.NoError(t, err, "re-running migration should not fail")

	// Verify data is still accessible
	memo, err := ts.GetMemo(ctx, &store.FindMemo{UID: &originalMemo.UID})
	require.NoError(t, err, "should retrieve memo after migration")
	require.Equal(t, "Data before migration re-run", memo.Content, "memo content should be preserved")
}

// TestMigrationMultipleReRuns verifies that migration is idempotent
// even when run multiple times in succession.
func TestMigrationMultipleReRuns(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Get initial version
	initialVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)

	// Run migration multiple times
	for i := 0; i < 3; i++ {
		err = ts.Migrate(ctx)
		require.NoError(t, err, "migration run %d should not fail", i+1)
	}

	// Verify version is still correct
	finalVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, initialVersion, finalVersion, "version should remain unchanged after multiple re-runs")
}

// TestMigrationCopiesInstanceTagsToUserSettings verifies instance tag metadata is copied into user settings.
func TestMigrationCopiesInstanceTagsToUserSettings(t *testing.T) {
	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping focused migration fixture for non-sqlite driver")
	}

	ctx := context.Background()
	dsn := fmt.Sprintf("%s/memos_tag_migration.db", t.TempDir())

	db, err := sql.Open("sqlite", dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, `
		CREATE TABLE system_setting (
			name TEXT NOT NULL,
			value TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			UNIQUE(name)
		);
		CREATE TABLE user (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			role TEXT NOT NULL DEFAULT 'USER'
		);
		CREATE TABLE user_setting (
			user_id INTEGER NOT NULL,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			UNIQUE(user_id, key)
		);
		CREATE TABLE memo (
			id INTEGER PRIMARY KEY AUTOINCREMENT
		);
	`)
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.29.1"})
	require.NoError(t, err)
	tagsSettingBytes, err := protojson.Marshal(&storepb.InstanceTagsSetting{
		Tags: map[string]*storepb.InstanceTagMetadata{
			"bug": {
				BackgroundColor: &colorpb.Color{Red: 0.9, Green: 0.1, Blue: 0.1},
			},
			"private/.*": {
				BlurContent: true,
			},
		},
	})
	require.NoError(t, err)
	existingUserTagsBytes, err := protojson.Marshal(&storepb.TagsUserSetting{
		Tags: map[string]*storepb.UserTagMetadata{
			"existing": {
				BlurContent: true,
			},
		},
	})
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, "INSERT INTO system_setting (name, value) VALUES ('BASIC', ?), ('TAGS', ?)", string(basicSettingBytes), string(tagsSettingBytes))
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, "INSERT INTO user (id, username, role) VALUES (1, 'tag-owner', 'USER'), (2, 'keeps-existing', 'USER')")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, "INSERT INTO user_setting (user_id, key, value) VALUES (2, 'TAGS', ?)", string(existingUserTagsBytes))
	require.NoError(t, err)
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	copiedUserID := int32(1)
	copied, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &copiedUserID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.Contains(t, copied.GetTags().GetTags(), "bug")
	bugMetadata := copied.GetTags().GetTags()["bug"]
	require.NotNil(t, bugMetadata.GetBackgroundColor())
	require.InDelta(t, 0.9, bugMetadata.GetBackgroundColor().GetRed(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetGreen(), 1e-6)
	require.InDelta(t, 0.1, bugMetadata.GetBackgroundColor().GetBlue(), 1e-6)
	require.True(t, copied.GetTags().GetTags()["private/.*"].GetBlurContent())

	existingUserID := int32(2)
	existing, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &existingUserID,
		Key:    storepb.UserSetting_TAGS,
	})
	require.NoError(t, err)
	require.Contains(t, existing.GetTags().GetTags(), "existing")
	require.NotContains(t, existing.GetTags().GetTags(), "bug")
}

// TestMigrationFromStableVersion verifies that upgrading from a stable Memos version
// to the current version works correctly. This is the critical upgrade path test.
//
// Test flow:
// 1. Start a stable Memos container to create a database with the old schema
// 2. Stop the container and wait for cleanup
// 3. Use the store directly to run migration with current code
// 4. Verify the migration succeeded and data can be written
//
// Note: This test is skipped when running with -race flag because testcontainers
// has known race conditions in its reaper code that are outside our control.
func TestMigrationFromStableVersion(t *testing.T) {
	// Skip for non-SQLite drivers (simplifies the test)
	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping upgrade test for non-sqlite driver")
	}

	skipIfContainerProviderUnavailable(t)

	ctx := context.Background()
	dataDir := t.TempDir()

	// 1. Start stable Memos container to create database with old schema
	cfg := MemosContainerConfig{
		Driver:  "sqlite",
		DataDir: dataDir,
		Version: StableMemosVersion,
	}

	t.Logf("Starting Memos %s container to create old-schema database...", cfg.Version)
	container, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start stable memos container")

	// Wait for the container to fully initialize the database
	time.Sleep(10 * time.Second)

	// Stop the container gracefully
	t.Log("Stopping stable Memos container...")
	err = container.Terminate(ctx)
	require.NoError(t, err, "failed to stop memos container")

	// Wait for file handles to be released
	time.Sleep(2 * time.Second)

	// 2. Connect to the database directly and run migration with current code
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)
	t.Logf("Connecting to database at %s...", dsn)

	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)

	// Get the schema version before migration
	oldSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	t.Logf("Old schema version: %s", oldSetting.SchemaVersion)

	// 3. Run migration with current code
	t.Log("Running migration with current code...")
	err = ts.Migrate(ctx)
	require.NoError(t, err, "migration from stable version should succeed")

	// 4. Verify migration succeeded
	newVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	t.Logf("New schema version: %s", newVersion)

	newSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, newVersion, newSetting.SchemaVersion, "schema version should be updated")

	// Verify we can write data to the migrated database
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err, "should create user after migration")

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "post-upgrade-memo",
		CreatorID:  user.ID,
		Content:    "Content after upgrade from stable",
		Visibility: store.Public,
	})
	require.NoError(t, err, "should create memo after migration")
	require.Equal(t, "Content after upgrade from stable", memo.Content)

	t.Logf("Migration successful: %s -> %s", oldSetting.SchemaVersion, newVersion)
}

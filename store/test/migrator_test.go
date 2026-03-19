package test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

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

func TestMigrationBackfillsInboxMemoCommentPayload(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	commentMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "migration-comment-memo",
		CreatorID:  user.ID,
		Content:    "Comment memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	relatedMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "migration-related-memo",
		CreatorID:  user.ID,
		Content:    "Related memo",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	driver := getDriverFromEnv()
	require.NoError(t, createLegacyActivityTable(ctx, ts, driver))
	require.NoError(t, insertLegacyInboxActivity(ctx, ts, driver, user.ID, commentMemo.ID, relatedMemo.ID))
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{
			BasicSetting: &storepb.InstanceBasicSetting{
				SchemaVersion: "0.27.2",
			},
		},
	})
	require.NoError(t, err)

	err = ts.Migrate(ctx)
	require.NoError(t, err)

	messageType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &messageType,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.NotNil(t, inboxes[0].Message)
	require.NotNil(t, inboxes[0].Message.GetMemoComment())
	require.Equal(t, commentMemo.ID, inboxes[0].Message.GetMemoComment().MemoId)
	require.Equal(t, relatedMemo.ID, inboxes[0].Message.GetMemoComment().RelatedMemoId)
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

func createLegacyActivityTable(ctx context.Context, ts *store.Store, driver string) error {
	var stmt string
	switch driver {
	case "sqlite":
		stmt = `CREATE TABLE activity (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			creator_id INTEGER NOT NULL,
			created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
			type TEXT NOT NULL DEFAULT '',
			level TEXT NOT NULL DEFAULT 'INFO',
			payload TEXT NOT NULL DEFAULT '{}'
		);`
	case "mysql":
		stmt = `CREATE TABLE activity (
			id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			creator_id INT NOT NULL,
			created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			type VARCHAR(256) NOT NULL DEFAULT '',
			level VARCHAR(256) NOT NULL DEFAULT 'INFO',
			payload TEXT NOT NULL
		);`
	case "postgres":
		stmt = `CREATE TABLE activity (
			id SERIAL PRIMARY KEY,
			creator_id INTEGER NOT NULL,
			created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
			type TEXT NOT NULL DEFAULT '',
			level TEXT NOT NULL DEFAULT 'INFO',
			payload JSONB NOT NULL DEFAULT '{}'
		);`
	default:
		return errors.Errorf("unsupported driver: %s", driver)
	}
	_, err := ts.GetDriver().GetDB().ExecContext(ctx, stmt)
	return err
}

func insertLegacyInboxActivity(ctx context.Context, ts *store.Store, driver string, receiverID, memoID, relatedMemoID int32) error {
	var insertActivityStmt string
	var insertInboxStmt string
	payload := fmt.Sprintf(`{"memoComment":{"memoId":%d,"relatedMemoId":%d}}`, memoID, relatedMemoID)
	message := `{"type":"MEMO_COMMENT","activityId":1}`

	switch driver {
	case "sqlite", "mysql":
		insertActivityStmt = `INSERT INTO activity (id, creator_id, type, level, payload) VALUES (?, ?, ?, ?, ?)`
		insertInboxStmt = `INSERT INTO inbox (sender_id, receiver_id, status, message) VALUES (?, ?, ?, ?)`
	case "postgres":
		insertActivityStmt = `INSERT INTO activity (id, creator_id, type, level, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`
		insertInboxStmt = `INSERT INTO inbox (sender_id, receiver_id, status, message) VALUES ($1, $2, $3, $4)`
	default:
		return errors.Errorf("unsupported driver: %s", driver)
	}

	if _, err := ts.GetDriver().GetDB().ExecContext(ctx, insertActivityStmt, 1, receiverID, "MEMO_COMMENT", "INFO", payload); err != nil {
		return err
	}
	if _, err := ts.GetDriver().GetDB().ExecContext(ctx, insertInboxStmt, receiverID, receiverID, store.UNREAD, message); err != nil {
		return err
	}
	return nil
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

	// Skip if explicitly disabled (e.g., in environments without Docker)
	if os.Getenv("SKIP_CONTAINER_TESTS") == "1" {
		t.Skip("skipping container-based test (SKIP_CONTAINER_TESTS=1)")
	}

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

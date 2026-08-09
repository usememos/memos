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

// TestMigrationMemoViewSetting verifies the 0.31 rename of the SHORTCUTS user setting
// to MEMO_VIEWS on every driver, since each one rewrites the stored JSON with its own
// dialect-specific functions.
func TestMigrationMemoViewSetting(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_memo_view_migration.db", t.TempDir())
	case "mysql":
		dsn = GetMySQLDSN(t)
	case "postgres":
		dsn = GetPostgresDSN(t)
	default:
		t.Fatalf("unsupported driver: %s", driver)
	}

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.30.2"})
	require.NoError(t, err)
	insertBasicSetting := "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', ?, '')"
	if driver == "postgres" {
		insertBasicSetting = "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', $1, '')"
	}
	_, err = db.ExecContext(ctx, insertBasicSetting, string(basicSettingBytes))
	require.NoError(t, err)

	settingKeyColumn := "key"
	if driver == "mysql" {
		settingKeyColumn = "`key`"
	}
	// Bound rather than inlined: MySQL treats backslash as an escape character inside
	// string literals, so an inlined \" would collapse and corrupt the fixture's JSON.
	insertSetting := fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES (?, ?, ?)", settingKeyColumn)
	if driver == "postgres" {
		insertSetting = fmt.Sprintf("INSERT INTO user_setting (user_id, %[1]s, value) VALUES ($1, $2, $3)", settingKeyColumn)
	}
	settingRows := []struct {
		userID int
		key    string
		value  string
	}{
		// A normal legacy row, must be renamed and rewritten.
		{1, "SHORTCUTS", `{"shortcuts":[{"id":"work","title":"shortcuts","filter":"tag in [\"work\"]"}]}`},
		// A corrupt value, must be left alone rather than aborting the upgrade.
		{2, "SHORTCUTS", `{oops}`},
		// Already has a MEMO_VIEWS row, must not trip UNIQUE(user_id, key).
		{3, "SHORTCUTS", `{"shortcuts":[{"id":"old","title":"old","filter":"tag in [\"old\"]"}]}`},
		{3, "MEMO_VIEWS", `{"memoViews":[{"id":"new","title":"new","filter":"tag in [\"new\"]"}]}`},
	}
	for _, row := range settingRows {
		_, err = db.ExecContext(ctx, insertSetting, row.userID, row.key, row.value)
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	migratedUserID := int32(1)
	setting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &migratedUserID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Len(t, setting.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "work", setting.GetMemoViews().GetMemoViews()[0].GetId())
	require.Equal(t, "shortcuts", setting.GetMemoViews().GetMemoViews()[0].GetTitle())
	require.Equal(t, `tag in ["work"]`, setting.GetMemoViews().GetMemoViews()[0].GetFilter())

	// Malformed object-like JSON must neither abort the migration nor be renamed.
	findCorruptSetting := fmt.Sprintf("SELECT value FROM user_setting WHERE user_id = ? AND %s = ?", settingKeyColumn)
	if driver == "postgres" {
		findCorruptSetting = fmt.Sprintf("SELECT value FROM user_setting WHERE user_id = $1 AND %s = $2", settingKeyColumn)
	}
	var corruptValue string
	err = ts.GetDriver().GetDB().QueryRowContext(ctx, findCorruptSetting, 2, "SHORTCUTS").Scan(&corruptValue)
	require.NoError(t, err)
	require.Equal(t, `{oops}`, corruptValue)

	// The pre-existing MEMO_VIEWS row wins; the legacy row is left behind untouched.
	conflictUserID := int32(3)
	conflicting, err := ts.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &conflictUserID,
		Key:    storepb.UserSetting_MEMO_VIEWS,
	})
	require.NoError(t, err)
	require.NotNil(t, conflicting)
	require.Len(t, conflicting.GetMemoViews().GetMemoViews(), 1)
	require.Equal(t, "new", conflicting.GetMemoViews().GetMemoViews()[0].GetId())
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
			created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
			updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
			row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
			username TEXT NOT NULL UNIQUE,
			role TEXT NOT NULL DEFAULT 'USER',
			email TEXT NOT NULL DEFAULT '',
			nickname TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL,
			avatar_url TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT ''
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
	_, err = db.ExecContext(ctx, `
		INSERT INTO user (id, username, role, password_hash, avatar_url)
		VALUES (1, 'tag-owner', 'USER', 'legacy-hash', ''), (2, 'keeps-existing', 'USER', 'legacy-hash', '')
	`)
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

func TestCaseSensitiveUsernameMigration(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_username_migration.db", t.TempDir())
	case "mysql":
		dsn = GetMySQLDSN(t)
	case "postgres":
		dsn = GetPostgresDSN(t)
	default:
		t.Fatalf("unsupported driver: %s", driver)
	}

	db, err := sql.Open(driver, dsn)
	require.NoError(t, err)

	_, err = db.ExecContext(ctx, legacySchemaFixture(driver))
	require.NoError(t, err)

	basicSettingBytes, err := protojson.Marshal(&storepb.InstanceBasicSetting{SchemaVersion: "0.30.1"})
	require.NoError(t, err)
	insertBasicSetting := "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', ?, '')"
	if driver == "postgres" {
		insertBasicSetting = "INSERT INTO system_setting (name, value, description) VALUES ('BASIC', $1, '')"
	}
	_, err = db.ExecContext(ctx, insertBasicSetting, string(basicSettingBytes))
	require.NoError(t, err)
	insertUser := "INSERT INTO user (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')"
	if driver == "mysql" {
		insertUser = "INSERT INTO `user` (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')"
	} else if driver == "postgres" {
		insertUser = `INSERT INTO "user" (username, role, password_hash, avatar_url) VALUES ('Alice', 'USER', 'legacy-hash', '')`
	}
	_, err = db.ExecContext(ctx, insertUser)
	require.NoError(t, err)
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	lower, err := createTestingUserWithRole(ctx, ts, "alice", store.RoleUser)
	require.NoError(t, err)

	upperUsername := "Alice"
	upper, err := ts.GetUser(ctx, &store.FindUser{Username: &upperUsername})
	require.NoError(t, err)
	require.NotEqual(t, upper.ID, lower.ID)
	require.Equal(t, "Alice", upper.Username)
}

func legacySchemaFixture(driver string) string {
	switch driver {
	case "mysql":
		return `
			CREATE TABLE system_setting (
				name VARCHAR(256) NOT NULL PRIMARY KEY,
				value LONGTEXT NOT NULL,
				description TEXT NOT NULL
			);
			CREATE TABLE ` + "`user`" + ` (
				id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
				created_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				row_status VARCHAR(256) NOT NULL DEFAULT 'NORMAL',
				username VARCHAR(256) NOT NULL UNIQUE,
				role VARCHAR(256) NOT NULL DEFAULT 'USER',
				email VARCHAR(256) NOT NULL DEFAULT '',
				nickname VARCHAR(256) NOT NULL DEFAULT '',
				password_hash VARCHAR(256) NOT NULL,
				avatar_url LONGTEXT NOT NULL,
				description VARCHAR(256) NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INT NOT NULL,
				` + "`key`" + ` VARCHAR(256) NOT NULL,
				value LONGTEXT NOT NULL,
				UNIQUE(user_id, ` + "`key`" + `)
			);
			CREATE TABLE memo (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY);
		`
	case "postgres":
		return `
			CREATE TABLE system_setting (
				name TEXT NOT NULL PRIMARY KEY,
				value TEXT NOT NULL,
				description TEXT NOT NULL
			);
			CREATE TABLE "user" (
				id SERIAL PRIMARY KEY,
				created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
				row_status TEXT NOT NULL DEFAULT 'NORMAL',
				username TEXT NOT NULL UNIQUE,
				role TEXT NOT NULL DEFAULT 'USER',
				email TEXT NOT NULL DEFAULT '',
				nickname TEXT NOT NULL DEFAULT '',
				password_hash TEXT NOT NULL,
				avatar_url TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INTEGER NOT NULL,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				UNIQUE(user_id, key)
			);
			CREATE TABLE memo (id SERIAL PRIMARY KEY);
		`
	case "sqlite":
		return `
			CREATE TABLE system_setting (
				name TEXT NOT NULL,
				value TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				UNIQUE(name)
			);
			CREATE TABLE user (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
				row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
				username TEXT NOT NULL UNIQUE,
				role TEXT NOT NULL DEFAULT 'USER',
				email TEXT NOT NULL DEFAULT '',
				nickname TEXT NOT NULL DEFAULT '',
				password_hash TEXT NOT NULL,
				avatar_url TEXT NOT NULL DEFAULT '',
				description TEXT NOT NULL DEFAULT ''
			);
			CREATE TABLE user_setting (
				user_id INTEGER NOT NULL,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				UNIQUE(user_id, key)
			);
			CREATE TABLE memo (id INTEGER PRIMARY KEY AUTOINCREMENT);
		`
	default:
		return ""
	}
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

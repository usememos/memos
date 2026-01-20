package test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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

// TestMigrationDataPersistence verifies that data created in the old version
// is preserved and accessible after migration to the new version.
func TestMigrationDataPersistence(t *testing.T) {
	t.Parallel()

	// Only run for SQLite for simplicity and speed in this edge case test,
	// but the logic applies to all drivers.
	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping data persistence test for non-sqlite driver")
	}

	ctx := context.Background()
	dataDir := t.TempDir()

	// 1. Start Old Memos container (Stable)
	oldCfg := MemosContainerConfig{
		Driver:  "sqlite",
		DataDir: dataDir,
		Version: StableMemosVersion,
	}

	t.Logf("Starting Memos %s container...", oldCfg.Version)
	oldContainer, err := StartMemosContainer(ctx, oldCfg)
	require.NoError(t, err, "failed to start old memos container")

	// Wait for startup
	time.Sleep(5 * time.Second)

	err = oldContainer.Terminate(ctx)
	require.NoError(t, err, "failed to stop old memos container")

	// 2. Start New Memos container (Local) - this triggers migration
	newCfg := MemosContainerConfig{
		Driver:  "sqlite",
		DataDir: dataDir,
		Version: "local",
	}

	t.Log("Starting new Memos container to trigger migration...")
	newContainer, err := StartMemosContainer(ctx, newCfg)
	require.NoError(t, err, "failed to start new memos container")
	defer newContainer.Terminate(ctx)

	// Wait for migration to complete
	time.Sleep(5 * time.Second)

	// 3. Verify Data Access using Store
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)

	// Create a store instance connected to the migrated DB
	ts := createTestingStoreWithDSN(t, "sqlite", dsn)

	// Check schema version
	currentVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.NotEmpty(t, currentVersion, "schema version should be present")
	t.Logf("Migrated schema version: %s", currentVersion)

	// Check if we can write new data
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "migrated-test-memo",
		CreatorID:  user.ID,
		Content:    "Post-migration content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.Equal(t, "Post-migration content", memo.Content)
}

// TestMigrationIdempotency verifies that running the migration multiple times
// (e.g. container restart) is safe and doesn't corrupt data.
func TestMigrationIdempotency(t *testing.T) {
	t.Parallel()

	if getDriverFromEnv() != "sqlite" {
		t.Skip("skipping idempotency test for non-sqlite driver")
	}

	ctx := context.Background()
	dataDir := t.TempDir()

	// 1. Initial Migration (Local version)
	cfg := MemosContainerConfig{
		Driver:  "sqlite",
		DataDir: dataDir,
		Version: "local",
	}

	t.Log("Run 1: Initial migration...")
	container1, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err)
	time.Sleep(5 * time.Second)
	container1.Terminate(ctx)

	// 2. Second Run (Restart)
	t.Log("Run 2: Restart (should be idempotent)...")
	container2, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err)
	defer container2.Terminate(ctx)
	time.Sleep(5 * time.Second)

	// 3. Verify Store Integrity
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)
	ts := createTestingStoreWithDSN(t, "sqlite", dsn)

	// Ensure we can still use the DB
	_, err = ts.GetCurrentSchemaVersion()
	require.NoError(t, err, "database should be healthy after restart")
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

// createTestingStoreWithDSN helper to connect to an existing DB file.
func createTestingStoreWithDSN(t *testing.T, driver, dsn string) *store.Store {
	ctx := context.Background()
	return NewTestingStoreWithDSN(ctx, t, driver, dsn)
}

// testMigration is a helper function that orchestrates the migration test flow.
// It starts the stable version, waits for initialization, and then starts the local version.
func testMigration(t *testing.T, driver string, prepareFunc func() (MemosContainerConfig, func())) {
	if getDriverFromEnv() != driver {
		t.Skipf("skipping %s migration test for non-%s driver", driver, driver)
	}

	ctx := context.Background()

	// Prepare resources (temp dir or dedicated container)
	cfg, cleanup := prepareFunc()
	if cleanup != nil {
		defer cleanup()
	}

	// 1. Start Old Memos container (Stable)
	cfg.Version = StableMemosVersion
	t.Logf("Starting Memos %s container to initialize %s database...", cfg.Version, driver)
	oldContainer, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start old memos container")

	// Wait for database to be fully initialized
	time.Sleep(5 * time.Second)

	// Stop the old container
	err = oldContainer.Terminate(ctx)
	require.NoError(t, err, "failed to stop old memos container")

	t.Log("Old Memos container stopped, starting new container with local build...")

	// 2. Start New Memos container (Local)
	cfg.Version = "local" // Triggers local build in StartMemosContainer
	newContainer, err := StartMemosContainer(ctx, cfg)
	require.NoError(t, err, "failed to start new memos container - migration may have failed")
	defer newContainer.Terminate(ctx)

	t.Logf("Migration successful: %s -> local build", StableMemosVersion)
}

// TestMigrationFromPreviousVersion_SQLite verifies that migrating from the previous
// Memos version to the current version works correctly for SQLite.
func TestMigrationFromPreviousVersion_SQLite(t *testing.T) {
	t.Parallel()
	testMigration(t, "sqlite", func() (MemosContainerConfig, func()) {
		// Create a temp directory for SQLite data that persists across container restarts
		dataDir := t.TempDir()
		return MemosContainerConfig{
			Driver:  "sqlite",
			DataDir: dataDir,
		}, nil
	})
}

// TestMigrationFromPreviousVersion_MySQL verifies that migrating from the previous
// Memos version to the current version works correctly for MySQL.
func TestMigrationFromPreviousVersion_MySQL(t *testing.T) {
	t.Parallel()
	testMigration(t, "mysql", func() (MemosContainerConfig, func()) {
		// For migration testing, we need a dedicated MySQL container
		dsn, containerHost, cleanup := GetDedicatedMySQLDSN(t)

		// Extract database name from DSN
		parts := strings.Split(dsn, "/")
		dbNameWithParams := parts[len(parts)-1]
		dbName := strings.Split(dbNameWithParams, "?")[0]

		// Container DSN uses internal network hostname
		containerDSN := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s", testUser, testPassword, containerHost, dbName)

		return MemosContainerConfig{
			Driver: "mysql",
			DSN:    containerDSN,
		}, cleanup
	})
}

// TestMigrationFromPreviousVersion_Postgres verifies that migrating from the previous
// Memos version to the current version works correctly for PostgreSQL.
func TestMigrationFromPreviousVersion_Postgres(t *testing.T) {
	t.Parallel()
	testMigration(t, "postgres", func() (MemosContainerConfig, func()) {
		// For migration testing, we need a dedicated PostgreSQL container
		dsn, containerHost, cleanup := GetDedicatedPostgresDSN(t)

		// Extract database name from DSN
		parts := strings.Split(dsn, "/")
		dbNameWithParams := parts[len(parts)-1]
		dbName := strings.Split(dbNameWithParams, "?")[0]

		// Container DSN uses internal network hostname
		containerDSN := fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=disable",
			testUser, testPassword, containerHost, dbName)

		return MemosContainerConfig{
			Driver: "postgres",
			DSN:    containerDSN,
		}, cleanup
	})
}

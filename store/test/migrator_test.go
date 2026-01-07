package test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGetCurrentSchemaVersion(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	currentSchemaVersion, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err)
	require.Equal(t, "0.26.1", currentSchemaVersion)
}

// TestFreshInstall verifies that LATEST.sql applies correctly on a fresh database.
// This is essentially what NewTestingStore already does, but we make it explicit.
func TestFreshInstall(t *testing.T) {
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

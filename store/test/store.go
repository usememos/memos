package test

import (
	"context"
	"fmt"
	"net"
	"os"
	"testing"

	// sqlite driver.
	_ "modernc.org/sqlite"

	"github.com/joho/godotenv"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
	"github.com/usememos/memos/store/db/d1/d1test"
)

// NewTestingStore creates a new testing store with a fresh database.
// Each test gets its own isolated database:
//   - SQLite: new temp file per test
//   - MySQL/PostgreSQL: new database per test in shared container
//   - D1: new emulated database per test (see store/db/d1/d1test), reached
//     over the REST protocol or, with D1_ACCESS=bridge, the bridge protocol;
//     or the database named by D1_DSN when set. That database is shared, so
//     run one test at a time against it
func NewTestingStore(ctx context.Context, t *testing.T) *store.Store {
	driver := getDriverFromEnv()
	profile := getTestingProfileForDriver(t, driver)
	dbDriver, err := db.NewDBDriver(profile)
	if err != nil {
		t.Fatalf("failed to create db driver: %v", err)
	}

	store := store.New(dbDriver, profile)
	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	return store
}

// NewTestingStoreWithDSN creates a testing store connected to a specific DSN.
// This is useful for testing migrations on existing data.
func NewTestingStoreWithDSN(_ context.Context, t *testing.T, driver, dsn string) *store.Store {
	profile := &profile.Profile{
		Port:    getUnusedPort(),
		Data:    t.TempDir(), // Dummy dir, DSN matters
		DSN:     dsn,
		Driver:  driver,
		Version: version.GetCurrentVersion(),
	}
	dbDriver, err := db.NewDBDriver(profile)
	if err != nil {
		t.Fatalf("failed to create db driver: %v", err)
	}

	store := store.New(dbDriver, profile)
	// Do not run Migrate() automatically, as we might be testing pre-migration state
	// or want to run it manually.
	return store
}

// createSpaceMemberForTest keeps fixtures concise while exercising the same
// invitation and acceptance flow used by production code.
func createSpaceMemberForTest(ctx context.Context, testStore *store.Store, create *store.SpaceMember, actorUserID int32) (*store.SpaceMember, error) {
	if _, err := testStore.CreateSpaceInvitation(ctx, &store.SpaceInvitation{
		SpaceID: create.SpaceID,
		UserID:  create.UserID,
		Role:    create.Role,
	}, actorUserID); err != nil {
		return nil, err
	}
	return testStore.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{
		SpaceID: create.SpaceID,
		UserID:  create.UserID,
	}, create.UserID)
}

func getUnusedPort() int {
	// Get a random unused port
	listener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		panic(err)
	}
	defer listener.Close()

	// Get the port number
	port := listener.Addr().(*net.TCPAddr).Port
	return port
}

// getTestingProfileForDriver creates a testing profile for a specific driver.
func getTestingProfileForDriver(t *testing.T, driver string) *profile.Profile {
	// Attempt to load .env file if present (optional, for local development)
	_ = godotenv.Load(".env")

	// Get a temporary directory for the test data.
	dir := t.TempDir()
	mode := "prod"
	port := getUnusedPort()

	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_%s.db", dir, mode)
	case "mysql":
		dsn = GetMySQLDSN(t)
	case "postgres":
		dsn = GetPostgresDSN(t)
	case "d1":
		dsn = os.Getenv("D1_DSN")
		if dsn == "" {
			server := d1test.New(t)
			if os.Getenv("D1_ACCESS") == "bridge" {
				dsn = server.BridgeDSN()
			} else {
				dsn = server.DSN()
			}
		}
	default:
		t.Fatalf("unsupported driver: %s", driver)
	}

	return &profile.Profile{
		Port:    port,
		Data:    dir,
		DSN:     dsn,
		Driver:  driver,
		Version: version.GetCurrentVersion(),
	}
}

func getDriverFromEnv() string {
	driver := os.Getenv("DRIVER")
	if driver == "" {
		driver = "sqlite"
	}
	return driver
}

// skipRegexFiltersOnD1 skips tests whose matches() patterns go beyond
// literal text with anchors: D1 has no REGEXP operator, so the filter engine
// only expresses those and rejects everything else at compile time.
func skipRegexFiltersOnD1(t *testing.T) {
	t.Helper()
	if getDriverFromEnv() == "d1" {
		t.Skip("only literal regular expressions are supported on Cloudflare D1")
	}
}

// skipUnicodeFoldOnD1 skips tests that need Unicode case folding: D1 cannot
// register custom functions, so it folds with the ASCII-only LOWER().
func skipUnicodeFoldOnD1(t *testing.T) {
	t.Helper()
	if getDriverFromEnv() == "d1" {
		t.Skip("Cloudflare D1 folds case with ASCII-only LOWER()")
	}
}

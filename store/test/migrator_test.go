package test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
	storedb "github.com/usememos/memos/store/db"
)

type delayedInstanceSettingCreateDriver struct {
	store.Driver
	entered chan<- struct{}
	release <-chan struct{}
}

func (d *delayedInstanceSettingCreateDriver) CreateInstanceSettingIfNotExists(ctx context.Context, create *store.InstanceSetting) (bool, error) {
	d.entered <- struct{}{}
	<-d.release
	return d.Driver.CreateInstanceSettingIfNotExists(ctx, create)
}

func requireQueryError(ctx context.Context, t *testing.T, db *sql.DB, query, message string) {
	t.Helper()
	rows, err := db.QueryContext(ctx, query)
	if rows != nil {
		defer rows.Close()
		require.NoError(t, rows.Err())
	}
	require.Error(t, err, message)
}

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
	require.Equal(t, "0.31.8", currentSchemaVersion, "fresh install should start at the retained baseline")

	// Verify we can read instance settings (basic sanity check)
	instanceSetting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, instanceSetting.SchemaVersion)

	// The fresh schema supports memo-local Space placement without adding a
	// canonical thread shape. COMMENT remains an ordinary relation row.
	driver := getDriverFromEnv()
	insertSpace := "INSERT INTO space (id, uid, title, description, payload) VALUES (?, ?, ?, ?, '{}')"
	insertMemo := "INSERT INTO memo (id, uid, creator_id, content, visibility, payload, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
	insertRelation := "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES (?, ?, ?)"
	if driver == "postgres" {
		insertSpace = "INSERT INTO space (id, uid, title, description, payload) VALUES ($1, $2, $3, $4, '{}')"
		insertMemo = "INSERT INTO memo (id, uid, creator_id, content, visibility, payload, space_id) VALUES ($1, $2, $3, $4, $5, $6, $7)"
		insertRelation = "INSERT INTO memo_relation (memo_id, related_memo_id, type) VALUES ($1, $2, $3)"
	}
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertSpace, 900001, "fresh-space", "Fresh Space", "schema fixture")
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900001, "fresh-context", 1, "context", store.Public, `{}`, nil)
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertMemo, 900002, "fresh-comment", 1, "comment", store.SpaceAudience, `{}`, 900001)
	require.NoError(t, err)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, insertRelation, 900002, 900001, store.MemoRelationComment)
	require.NoError(t, err)

	var relationCount int
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM memo_relation WHERE memo_id = 900002 AND related_memo_id = 900001 AND type = 'COMMENT'",
	).Scan(&relationCount))
	require.Equal(t, 1, relationCount)

	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT parent_memo_id, root_memo_id FROM memo LIMIT 0", "fresh memo schema must not contain canonical-root columns")
	requireQueryError(ctx, t, ts.GetDriver().GetDB(), "SELECT row_status FROM space LIMIT 0", "fresh Space schema has no archived state")
	if driver == "sqlite" {
		var indexName string
		require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx,
			"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_memo_creator_id'",
		).Scan(&indexName))
		require.Equal(t, "idx_memo_creator_id", indexName)
	}
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

func TestConcurrentInstanceAccessInitializationKeepsFirstInsert(t *testing.T) {
	ctx := context.Background()
	driverName := getDriverFromEnv()
	baseProfile := getTestingProfileForDriver(t, driverName)

	baseDriver, err := storedb.NewDBDriver(baseProfile)
	require.NoError(t, err)
	baseStore := store.New(baseDriver, baseProfile)
	require.NoError(t, baseStore.Migrate(ctx))
	require.NoError(t, baseStore.DeleteInstanceSetting(ctx, &store.DeleteInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	}))
	require.NoError(t, baseStore.Close())

	publicProfile := *baseProfile
	publicProfile.InstanceURL = "https://public.example.com"
	publicDriver, err := storedb.NewDBDriver(&publicProfile)
	require.NoError(t, err)
	entered := make(chan struct{}, 1)
	release := make(chan struct{})
	delayedPublicDriver := &delayedInstanceSettingCreateDriver{
		Driver:  publicDriver,
		entered: entered,
		release: release,
	}
	publicStore := store.New(delayedPublicDriver, &publicProfile)
	defer publicStore.Close()

	privateProfile := *baseProfile
	privateProfile.InstanceURL = ""
	privateDriver, err := storedb.NewDBDriver(&privateProfile)
	require.NoError(t, err)
	privateStore := store.New(privateDriver, &privateProfile)
	defer privateStore.Close()

	publicMigration := make(chan error, 1)
	go func() {
		publicMigration <- publicStore.Migrate(ctx)
	}()
	<-entered
	released := false
	defer func() {
		if !released {
			close(release)
		}
	}()

	// The private instance reaches the database first. The delayed public
	// initializer must lose the unique-key race without overwriting it.
	require.NoError(t, privateStore.Migrate(ctx))
	close(release)
	released = true
	require.NoError(t, <-publicMigration)

	setting, err := privateStore.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	})
	require.NoError(t, err)
	require.NotNil(t, setting)
	require.Equal(t, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, setting.GetAccessSetting().AccessMode)

	// Re-running either initializer is also a no-op once ACCESS is persisted.
	require.NoError(t, publicStore.Migrate(ctx))
	setting, err = publicStore.GetStoredInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: storepb.InstanceSettingKey_ACCESS.String(),
	})
	require.NoError(t, err)
	require.Equal(t, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE, setting.GetAccessSetting().AccessMode)
}

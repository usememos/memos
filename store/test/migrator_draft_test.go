package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// TestMemoDraftSchemaVersionRecognizesSqliteOnly029 pins edge E9: the
// per-driver migration version scan must tolerate a SQLite-only 0.29 directory
// with no parallel mysql/postgres 0.29 (the drivers already diverge). The scan
// must not error, and for SQLite it must recognize 0.29 as the new max.
func TestMemoDraftSchemaVersionRecognizesSqliteOnly029(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	version, err := ts.GetCurrentSchemaVersion()
	require.NoError(t, err, "version scan must tolerate per-driver migration divergence (E9)")
	require.NotEmpty(t, version)

	if getDriverFromEnv() == "sqlite" {
		// migration/sqlite/0.29/00__memo_draft_state.sql -> "0.29" + (00+1) = "0.29.1".
		require.Equal(t, "0.29.1", version, "SQLite must recognize the new 0.29 migration as the latest schema version")
	}

	ts.Close()
}

// TestMemoDraftMigrationFreshInstallAcceptsDraft verifies that a fresh install
// (LATEST.sql) accepts a row_status='DRAFT' memo while still rejecting an
// unknown row_status — i.e. T1 widened the CHECK rather than dropping it. This
// is asserted via raw SQL so it is independent of the C4 driver bug and passes
// immediately after T1.
func TestMemoDraftMigrationFreshInstallAcceptsDraft(t *testing.T) {
	if getDriverFromEnv() != "sqlite" {
		t.Skip("fresh-install CHECK test is SQLite-specific (mysql/postgres have no row_status CHECK, C3)")
	}
	t.Parallel()
	ctx := context.Background()

	dataDir := t.TempDir()
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)
	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)
	require.NoError(t, ts.Migrate(ctx), "fresh install should apply LATEST.sql")

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	db := openMigrationSQLDB(t, "sqlite", dsn)
	defer db.Close()

	execMigrationSQL(t, db, fmt.Sprintf(
		"INSERT INTO memo (uid, creator_id, content, visibility, row_status) VALUES ('draft-fresh', %d, 'draft body', 'PRIVATE', 'DRAFT')",
		user.ID,
	))

	var rowStatus string
	require.NoError(t, db.QueryRowContext(ctx, "SELECT row_status FROM memo WHERE uid = 'draft-fresh'").Scan(&rowStatus))
	require.Equal(t, "DRAFT", rowStatus)

	// The CHECK must still reject an unknown lifecycle value (widened, not dropped).
	_, err = db.Exec(fmt.Sprintf(
		"INSERT INTO memo (uid, creator_id, content, visibility, row_status) VALUES ('bogus-rs', %d, 'x', 'PRIVATE', 'BOGUS')",
		user.ID,
	))
	require.Error(t, err, "row_status CHECK must still reject values outside NORMAL/ARCHIVED/DRAFT")

	ts.Close()
}

// TestMemoDraftMigrationPreservesRowsAndUnlocksDraft verifies that re-running
// the migrator is idempotent, preserves pre-existing rows, and that DRAFT is
// insertable post-migration. (The full stable-container 0.28->0.29 upgrade is
// exercised by TestMigrationFromStableVersion, which now includes 0.29.)
func TestMemoDraftMigrationPreservesRowsAndUnlocksDraft(t *testing.T) {
	if getDriverFromEnv() != "sqlite" {
		t.Skip("raw-SQL DRAFT insertion is exercised on SQLite; mysql/postgres have no CHECK to unlock (C3)")
	}
	t.Parallel()
	ctx := context.Background()

	dataDir := t.TempDir()
	dsn := fmt.Sprintf("%s/memos_prod.db", dataDir)
	ts := NewTestingStoreWithDSN(ctx, t, "sqlite", dsn)
	require.NoError(t, ts.Migrate(ctx))

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	preExisting, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "pre-migration-normal",
		CreatorID:  user.ID,
		Content:    "survives re-migration",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Re-run the migrator: must be idempotent and must not destroy rows.
	require.NoError(t, ts.Migrate(ctx), "re-running the migrator must be idempotent")

	found, err := ts.GetMemo(ctx, &store.FindMemo{UID: &preExisting.UID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, "survives re-migration", found.Content)

	db := openMigrationSQLDB(t, "sqlite", dsn)
	defer db.Close()
	execMigrationSQL(t, db, fmt.Sprintf(
		"INSERT INTO memo (uid, creator_id, content, visibility, row_status) VALUES ('draft-post-migrate', %d, 'draft', 'PRIVATE', 'DRAFT')",
		user.ID,
	))
	var count int
	require.NoError(t, db.QueryRowContext(ctx, "SELECT COUNT(*) FROM memo WHERE row_status = 'DRAFT'").Scan(&count))
	require.Equal(t, 1, count)

	ts.Close()
}

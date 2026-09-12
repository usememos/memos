package test

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestMigrationUniqueEmail drives 0.31/07__unique_email.sql against a
// pre-0.31 schema holding the cases the migration must resolve: mixed-case
// duplicates, surrounding whitespace, empty values, and values that are not
// addresses.
func TestMigrationUniqueEmail(t *testing.T) {
	ctx := context.Background()
	driver := getDriverFromEnv()
	var dsn string
	switch driver {
	case "sqlite":
		dsn = fmt.Sprintf("%s/memos_email_migration.db", t.TempDir())
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

	userTable := "user"
	switch driver {
	case "mysql":
		userTable = "`user`"
	case "postgres":
		userTable = `"user"`
	default:
	}
	insertUser := func(id int, username, email string) {
		t.Helper()
		stmt := fmt.Sprintf("INSERT INTO %s (id, username, role, email, password_hash, avatar_url) VALUES (%d, '%s', 'USER', '%s', 'legacy-hash', '')", userTable, id, username, email)
		_, err := db.ExecContext(ctx, stmt)
		require.NoError(t, err)
	}
	insertUser(1, "alice-upper", "Alice@Example.com")
	insertUser(2, "alice-spaced", " alice@example.com ")
	insertUser(3, "alice-lower", "alice@example.com")
	insertUser(4, "bob", "bob@example.com")
	insertUser(5, "no-address", "")
	insertUser(6, "junk", "not-an-address")
	insertUser(100, "deleted-high-user", "gone@example.com")
	_, err = db.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE id = 100", userTable))
	require.NoError(t, err)
	if driver == "postgres" {
		_, err = db.ExecContext(ctx, `SELECT setval(pg_get_serial_sequence('"user"', 'id'), 100, true)`)
		require.NoError(t, err)
	}
	require.NoError(t, db.Close())

	ts := NewTestingStoreWithDSN(ctx, t, driver, dsn)
	require.NoError(t, ts.Migrate(ctx))
	defer ts.Close()

	emailOf := func(id int32) string {
		t.Helper()
		user, err := ts.GetUser(ctx, &store.FindUser{ID: &id})
		require.NoError(t, err)
		require.NotNil(t, user, "user %d should survive the migration", id)
		return user.Email
	}
	require.Equal(t, "alice@example.com", emailOf(1), "the oldest account keeps the address")
	require.Equal(t, "", emailOf(2), "a later duplicate is cleared")
	require.Equal(t, "", emailOf(3), "a later duplicate is cleared")
	require.Equal(t, "bob@example.com", emailOf(4))
	require.Equal(t, "", emailOf(5))
	require.Equal(t, "", emailOf(6), "a value without '@' is cleared")

	// The index is in place and case folding applies to lookups and writes.
	lookup := "ALICE@EXAMPLE.COM"
	holder, err := ts.GetUser(ctx, &store.FindUser{Email: &lookup})
	require.NoError(t, err)
	require.NotNil(t, holder)
	require.Equal(t, int32(1), holder.ID)

	// IDs issued before the migration, including deleted ones, are never reused.
	// This runs before any failing insert because MySQL and PostgreSQL consume
	// an auto-increment value even when the insert is rejected.
	created, err := ts.CreateUser(ctx, &store.User{Username: "post-migration", Role: store.RoleUser, Email: ""})
	require.NoError(t, err)
	require.Equal(t, int32(101), created.ID)

	_, err = ts.CreateUser(ctx, &store.User{Username: "alice-again", Role: store.RoleUser, Email: "Alice@example.com"})
	require.ErrorIs(t, err, store.ErrEmailTaken)

	// Users without an address never conflict with one another.
	another, err := ts.CreateUser(ctx, &store.User{Username: "post-migration-2", Role: store.RoleUser, Email: ""})
	require.NoError(t, err)
	require.Equal(t, "", another.Email)

	// Re-running the migrator is a no-op.
	require.NoError(t, ts.Migrate(ctx))
}

package d1

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store/db/d1/d1test"
)

var errConflict = errors.New("conflict")

func newTestDB(t *testing.T) *DB {
	t.Helper()
	server := d1test.New(t)
	driver, err := NewDB(&profile.Profile{Driver: "d1", DSN: server.DSN()})
	require.NoError(t, err)
	db, ok := driver.(*DB)
	require.True(t, ok)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	return db
}

func TestParseDSN(t *testing.T) {
	config, err := ParseDSN("d1://acct/dbid?token=secret&endpoint=http://127.0.0.1:1/")
	require.NoError(t, err)
	require.Equal(t, "acct", config.AccountID)
	require.Equal(t, "dbid", config.DatabaseID)
	require.Equal(t, "secret", config.Token)
	require.Equal(t, "http://127.0.0.1:1", config.Endpoint)

	for _, endpoint := range []string{"http://127.0.0.1:8787", "http://localhost:8787", "http://[::1]:8787", "https://api.example.com/v4"} {
		_, err = ParseDSN("d1://acct/dbid?token=secret&endpoint=" + endpoint)
		require.NoError(t, err, endpoint)
	}
	for _, endpoint := range []string{"http://api.example.com", "ftp://api.example.com", "api.example.com"} {
		_, err = ParseDSN("d1://acct/dbid?token=secret&endpoint=" + endpoint)
		require.Error(t, err, endpoint)
	}

	_, err = ParseDSN("sqlite://x")
	require.ErrorContains(t, err, "d1:// scheme")
	_, err = ParseDSN("d1:///dbid?token=t")
	require.ErrorContains(t, err, "account id")
	t.Setenv("CLOUDFLARE_API_TOKEN", "")
	_, err = ParseDSN("d1://acct/dbid")
	require.ErrorContains(t, err, "token")
	t.Setenv("CLOUDFLARE_API_TOKEN", "from-env")
	config, err = ParseDSN("d1://acct/dbid")
	require.NoError(t, err)
	require.Equal(t, "from-env", config.Token)
	require.Equal(t, DefaultEndpoint, config.Endpoint)
}

func TestTransportRoundTrip(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)

	initialized, err := db.IsInitialized(ctx)
	require.NoError(t, err)
	require.False(t, initialized)

	// Multi-statement script through the sql adapter transaction, as the migrator does.
	tx, err := db.GetDB().Begin()
	require.NoError(t, err)
	_, err = tx.ExecContext(ctx, `
		-- schema
		CREATE TABLE d1_guard (ok INTEGER NOT NULL CONSTRAINT d1_guard_ok CHECK (ok = 1));
		CREATE TABLE memo (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL UNIQUE, content TEXT NOT NULL DEFAULT 'a;b', blob BLOB);
	`)
	require.NoError(t, err)
	require.NoError(t, tx.Commit())

	initialized, err = db.IsInitialized(ctx)
	require.NoError(t, err)
	require.True(t, initialized)

	// Parameter binding and RETURNING through database/sql.
	var id int64
	var content string
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "INSERT INTO memo (uid, blob) VALUES (?, unhex(?)) RETURNING id, content", "m1", "00ff").Scan(&id, &content))
	require.Equal(t, int64(1), id)
	require.Equal(t, "a;b", content)

	var hexBlob string
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "SELECT hex(blob) FROM memo WHERE id = ?", id).Scan(&hexBlob))
	require.Equal(t, "00FF", hexBlob)

	res, err := db.GetDB().ExecContext(ctx, "UPDATE memo SET content = ? WHERE id = ?", "changed", id)
	require.NoError(t, err)
	affected, err := res.RowsAffected()
	require.NoError(t, err)
	require.Equal(t, int64(1), affected)

	// Unique violations are recognizable.
	_, err = db.execOne(ctx, "INSERT INTO memo (uid) VALUES (?)", "m1")
	require.Error(t, err)
	require.True(t, isUniqueViolation(err), err.Error())
	require.False(t, isRetryable(err))

	// A batch commits atomically and reports per-statement changes.
	b := newBatch()
	first := b.add("INSERT INTO memo (uid) VALUES (?)", "m2")
	second := b.add("UPDATE memo SET content = ? WHERE uid IN (?, ?)", "both", "m1", "m2")
	results, err := b.commit(ctx, db)
	require.NoError(t, err)
	require.Len(t, results, 2)
	require.Equal(t, int64(1), results[first].Changes)
	require.Equal(t, int64(2), results[second].Changes)
	require.NoError(t, requireChanges(results, second, 2, errConflict))
	require.ErrorIs(t, requireChanges(results, second, 1, errConflict), errConflict)

	// A failing guard rolls the whole batch back.
	b = newBatch()
	b.add("INSERT INTO memo (uid) VALUES (?)", "m3")
	b.guard("EXISTS (SELECT 1 FROM memo WHERE uid = ?)", "missing")
	_, err = b.commit(ctx, db)
	require.Error(t, err)
	require.True(t, isGuardFailure(err), err.Error())
	require.ErrorIs(t, guardError(err, errConflict), errConflict)
	var count int
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM memo").Scan(&count))
	require.Equal(t, 2, count)

	// A passing guard leaves the batch intact and the guard table empty.
	b = newBatch()
	b.guard("EXISTS (SELECT 1 FROM memo WHERE uid = ?)", "m1")
	b.add("INSERT INTO memo (uid) VALUES (?)", "m3")
	_, err = b.commit(ctx, db)
	require.NoError(t, err)
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM d1_guard").Scan(&count))
	require.Equal(t, 0, count)

	// Buffered transactions with parameters commit as one batch, and reads
	// after a buffered write are refused.
	tx, err = db.GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	_, err = tx.ExecContext(ctx, "UPDATE memo SET content = ? WHERE uid = ?", "tx", "m1")
	require.NoError(t, err)
	err = tx.QueryRowContext(ctx, "SELECT 1").Scan(&count)
	require.ErrorIs(t, err, errUnsupportedQueryInTx)
	require.NoError(t, tx.Commit())
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "SELECT content FROM memo WHERE uid = ?", "m1").Scan(&content))
	require.Equal(t, "tx", content)

	// Bind limit is enforced before the request leaves the process.
	args := make([]any, maxBoundParameters+1)
	_, err = db.execOne(ctx, "SELECT 1", args...)
	require.ErrorContains(t, err, "limit is 100")

	size, err := db.GetDatabaseSize(ctx)
	require.NoError(t, err)
	require.Greater(t, size, int64(0))
}

func TestNullAndTypedScans(t *testing.T) {
	ctx := context.Background()
	db := newTestDB(t)
	_, err := db.execOne(ctx, "CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER, f REAL, s TEXT, ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')))")
	require.NoError(t, err)
	var nilInt *int32
	_, err = db.execOne(ctx, "INSERT INTO t (n, f, s) VALUES (?, ?, ?)", nilInt, 1.5, "x")
	require.NoError(t, err)
	var n *int32
	var f float64
	var s string
	var ts int64
	require.NoError(t, db.GetDB().QueryRowContext(ctx, "SELECT n, f, s, ts FROM t").Scan(&n, &f, &s, &ts))
	require.Nil(t, n)
	require.Equal(t, 1.5, f)
	require.Equal(t, "x", s)
	require.Greater(t, ts, int64(0))
}

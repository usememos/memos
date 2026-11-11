package sqlite

import (
	"database/sql"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
	"testing"
)

// TestMemoEncryptionError distinguishes the object constraint from memo IDs and other SQLite failures.
func TestMemoEncryptionError(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec("CREATE TABLE memo_encryption (memo_id INTEGER PRIMARY KEY, vault_id TEXT, object_id TEXT, UNIQUE(vault_id,object_id))")
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO memo_encryption VALUES (1,'vault','object')")
	require.NoError(t, err)
	_, err = db.Exec("INSERT INTO memo_encryption VALUES (2,'vault','object')")
	require.ErrorIs(t, memoEncryptionError(err), store.ErrEncryptionConflict)
	_, err = db.Exec("INSERT INTO memo_encryption VALUES (1,'vault','other')")
	require.Error(t, err)
	require.Same(t, err, memoEncryptionError(err))
	unavailable := errors.New("database unavailable")
	require.Same(t, unavailable, memoEncryptionError(unavailable))
	require.NoError(t, memoEncryptionError(nil))
}

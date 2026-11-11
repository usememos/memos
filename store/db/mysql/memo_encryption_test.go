package mysql

import (
	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"github.com/usememos/memos/store"
	"testing"
)

// TestMemoEncryptionError checks that only the object-identity constraint becomes a conflict.
func TestMemoEncryptionError(t *testing.T) {
	for _, tc := range []struct {
		err      error
		conflict bool
	}{
		{&mysqldriver.MySQLError{Number: 1062, Message: "Duplicate entry 'x' for key 'memo_encryption.vault_id'"}, true},
		{&mysqldriver.MySQLError{Number: 1062, Message: "Duplicate entry 'x' for key 'vault_id'"}, true},
		{&mysqldriver.MySQLError{Number: 1062, Message: "Duplicate entry 'x' for key 'memo_encryption.PRIMARY'"}, false},
		{&mysqldriver.MySQLError{Number: 1205, Message: "lock wait timeout"}, false},
		{errors.New("database unavailable"), false},
	} {
		wrapped := errors.Wrap(tc.err, "insert failed")
		result := memoEncryptionError(wrapped)
		if tc.conflict {
			require.ErrorIs(t, result, store.ErrEncryptionConflict)
		} else {
			require.Same(t, wrapped, result)
		}
	}
	require.NoError(t, memoEncryptionError(nil))
}

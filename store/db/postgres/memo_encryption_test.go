package postgres

import (
	"github.com/lib/pq"
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
		{&pq.Error{Code: "23505", Constraint: "memo_encryption_vault_id_object_id_key"}, true},
		{&pq.Error{Code: "23505", Constraint: "memo_encryption_pkey"}, false},
		{&pq.Error{Code: "23503", Constraint: "memo_encryption_memo_id_fkey"}, false},
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

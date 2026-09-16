package sqlsplit

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSplit(t *testing.T) {
	statements := Split(`
		-- leading comment; with a semicolon
		CREATE TABLE t (name TEXT DEFAULT 'a;b', "quoted;col" TEXT);
		/* block; comment */
		INSERT INTO t (name) VALUES ('it''s; fine');

		SELECT 1
	`)
	require.Equal(t, []string{
		`CREATE TABLE t (name TEXT DEFAULT 'a;b', "quoted;col" TEXT)`,
		`INSERT INTO t (name) VALUES ('it''s; fine')`,
		`SELECT 1`,
	}, statements)

	require.Empty(t, Split("-- only a comment\n"))
	require.Empty(t, Split("  ;; "))
	require.Equal(t, []string{"SELECT 'unterminated"}, Split("SELECT 'unterminated"))
}

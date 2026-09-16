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

func TestSplitKeepsCommentsAsWhitespace(t *testing.T) {
	require.Equal(t, []string{"SELECT 1", "SELECT 2"}, Split("SELECT/**/1;SELECT--x\n2"))
}

func TestSplitKeepsTriggerBodies(t *testing.T) {
	trigger := `CREATE TRIGGER IF NOT EXISTS trigger_update_memo_modification_time
	AFTER UPDATE ON memo
	FOR EACH ROW
	BEGIN
		UPDATE memo SET updated_ts = strftime('%s', 'now') WHERE id = NEW.id;
		UPDATE memo SET pinned = CASE WHEN NEW.pinned = 1 THEN 1 ELSE 0 END WHERE id = NEW.id;
	END`
	statements := Split("DROP TRIGGER IF EXISTS trigger_update_memo_modification_time;\n" + trigger + ";\ncreate temp trigger tmp before insert on memo begin select 1; end;\nSELECT 3")
	require.Equal(t, []string{
		"DROP TRIGGER IF EXISTS trigger_update_memo_modification_time",
		trigger,
		"create temp trigger tmp before insert on memo begin select 1; end",
		"SELECT 3",
	}, statements)

	// CASE outside a trigger has no effect on splitting.
	require.Equal(t, []string{"SELECT CASE WHEN 1 THEN 'a;b' END", "SELECT 2"}, Split("SELECT CASE WHEN 1 THEN 'a;b' END; SELECT 2"))
}

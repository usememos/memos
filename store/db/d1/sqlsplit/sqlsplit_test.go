package sqlsplit

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSplitOneStatementPerParagraph(t *testing.T) {
	statements := Split("-- header comment\n\n-- user\nCREATE TABLE user (\n  id INTEGER PRIMARY KEY,\n  name TEXT DEFAULT 'a;b'\n);\n\n\nCREATE INDEX idx ON user(name);\r\n\r\nSELECT 1\n")
	require.Equal(t, []string{
		"-- user\nCREATE TABLE user (\n  id INTEGER PRIMARY KEY,\n  name TEXT DEFAULT 'a;b'\n);",
		"CREATE INDEX idx ON user(name);",
		"SELECT 1",
	}, statements)

	require.Empty(t, Split("-- only a comment\n\n  -- another\n"))
	require.Empty(t, Split("\n\n"))
}

func TestSplitKeepsCompoundStatementsTogether(t *testing.T) {
	trigger := "CREATE TRIGGER t AFTER UPDATE ON memo\nBEGIN\n  UPDATE memo SET updated_ts = 1 WHERE id = NEW.id;\n  UPDATE memo SET pinned = CASE WHEN NEW.pinned = 1 THEN 1 ELSE 0 END WHERE id = NEW.id;\nEND;"
	require.Equal(t, []string{"DROP TRIGGER IF EXISTS t;", trigger}, Split("DROP TRIGGER IF EXISTS t;\n\n"+trigger))
}

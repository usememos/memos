package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

// rejectStoreDelete injects a real database failure in an isolated test database.
// Table names are fixed by the tests, never supplied by application input.
func rejectStoreDelete(t *testing.T, ts *store.Store, table string) func() {
	t.Helper()
	var statements []string
	drop := "DROP TRIGGER reject_store_delete"
	switch getDriverFromEnv() {
	case "sqlite":
		statements = []string{fmt.Sprintf(`CREATE TRIGGER reject_store_delete BEFORE DELETE ON %s
			BEGIN SELECT RAISE(ABORT, 'store test delete failure'); END`, table)}
	case "mysql":
		statements = []string{fmt.Sprintf(`CREATE TRIGGER reject_store_delete BEFORE DELETE ON %s
			FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'store test delete failure'`, table)}
	case "postgres":
		statements = []string{
			`CREATE FUNCTION reject_store_delete() RETURNS trigger AS $$
			BEGIN RAISE EXCEPTION 'store test delete failure'; END; $$ LANGUAGE plpgsql`,
			fmt.Sprintf(`CREATE TRIGGER reject_store_delete BEFORE DELETE ON %s
			FOR EACH ROW EXECUTE FUNCTION reject_store_delete()`, table),
		}
		drop += " ON " + table
	default:
		t.Fatalf("unsupported driver: %s", getDriverFromEnv())
	}
	for _, statement := range statements {
		_, err := ts.GetDriver().GetDB().ExecContext(context.Background(), statement)
		require.NoError(t, err)
	}
	return func() {
		t.Helper()
		_, err := ts.GetDriver().GetDB().ExecContext(context.Background(), drop)
		require.NoError(t, err)
	}
}

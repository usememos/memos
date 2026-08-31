package sqlite

import (
	"context"
	"database/sql"
)

// dbExecutor is the common query surface implemented by the database handle
// and its transactions.
type dbExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

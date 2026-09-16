package d1

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"io"
	"strings"

	"github.com/pkg/errors"
)

// The types below adapt the transport to database/sql so that the migrator
// and tests can use GetDB(). D1 has no interactive transactions: a Tx buffers
// its writes and commits them as one atomic batch, and refuses reads once a
// write has been buffered because the write is not yet visible.

var errUnsupportedQueryInTx = errors.New("d1: reads inside a transaction must precede writes; buffered writes are only visible after commit")

type sqlDriver struct{}

func (sqlDriver) Open(string) (driver.Conn, error) {
	return nil, errors.New("d1: open the database through NewDB")
}

type connector struct {
	transport transport
}

func (c *connector) Connect(context.Context) (driver.Conn, error) {
	return &conn{transport: c.transport}, nil
}

func (*connector) Driver() driver.Driver {
	return sqlDriver{}
}

func openSQLDB(t transport) *sql.DB {
	db := sql.OpenDB(&connector{transport: t})
	// Every connection is a stateless HTTP session; keep the pool small so
	// concurrent callers do not fan out into the REST rate limit.
	db.SetMaxOpenConns(8)
	return db
}

type conn struct {
	transport transport
	tx        *tx
}

func (c *conn) Prepare(query string) (driver.Stmt, error) {
	return &stmt{conn: c, query: query}, nil
}

func (*conn) Close() error {
	return nil
}

func (c *conn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *conn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	if c.tx != nil {
		return nil, errors.New("d1: transaction already in progress")
	}
	c.tx = &tx{conn: c}
	return c.tx, nil
}

func (c *conn) Ping(ctx context.Context) error {
	_, err := c.transport.exec(ctx, statement{SQL: "SELECT 1"})
	return err
}

func (c *conn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	stmt := statement{SQL: query, Args: namedValues(args)}
	if c.tx != nil {
		c.tx.pending = append(c.tx.pending, stmt)
		return deferredResult{}, nil
	}
	res, err := c.transport.exec(ctx, stmt)
	if err != nil {
		return nil, err
	}
	return execResult{changes: res.Changes, lastRowID: res.LastRowID}, nil
}

func (c *conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if c.tx != nil && len(c.tx.pending) > 0 {
		return nil, errUnsupportedQueryInTx
	}
	res, err := c.transport.exec(ctx, statement{SQL: query, Args: namedValues(args)})
	if err != nil {
		return nil, err
	}
	return &rows{result: res}, nil
}

// CheckNamedValue accepts every value encodeArgs understands so database/sql
// does not reject named string types before they reach the converter.
func (*conn) CheckNamedValue(value *driver.NamedValue) error {
	converted, err := driver.DefaultParameterConverter.ConvertValue(value.Value)
	if err != nil {
		return err
	}
	value.Value = converted
	return nil
}

func namedValues(args []driver.NamedValue) []any {
	values := make([]any, 0, len(args))
	for _, arg := range args {
		values = append(values, arg.Value)
	}
	return values
}

type stmt struct {
	conn  *conn
	query string
}

func (*stmt) Close() error { return nil }

func (*stmt) NumInput() int { return -1 }

func (s *stmt) Exec(args []driver.Value) (driver.Result, error) {
	return s.ExecContext(context.Background(), valuesToNamed(args))
}

func (s *stmt) Query(args []driver.Value) (driver.Rows, error) {
	return s.QueryContext(context.Background(), valuesToNamed(args))
}

func (s *stmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return s.conn.ExecContext(ctx, s.query, args)
}

func (s *stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.conn.QueryContext(ctx, s.query, args)
}

func valuesToNamed(values []driver.Value) []driver.NamedValue {
	named := make([]driver.NamedValue, 0, len(values))
	for i, value := range values {
		named = append(named, driver.NamedValue{Ordinal: i + 1, Value: value})
	}
	return named
}

type tx struct {
	conn    *conn
	pending []statement
}

func (t *tx) Commit() error {
	defer t.finish()
	if len(t.pending) == 0 {
		return nil
	}
	ctx := context.Background()
	if parameterFree(t.pending) {
		// Each buffered text is a script that already follows the one
		// statement per paragraph rule, so a blank line joins them into one
		// script that still does.
		sqls := make([]string, 0, len(t.pending))
		for _, stmt := range t.pending {
			sqls = append(sqls, strings.TrimSpace(stmt.SQL))
		}
		return t.conn.transport.script(ctx, strings.Join(sqls, "\n\n"))
	}
	_, err := t.conn.transport.batch(ctx, t.pending)
	return err
}

func (t *tx) Rollback() error {
	t.finish()
	return nil
}

func (t *tx) finish() {
	t.pending = nil
	if t.conn.tx == t {
		t.conn.tx = nil
	}
}

func parameterFree(stmts []statement) bool {
	for _, stmt := range stmts {
		if len(stmt.Args) > 0 {
			return false
		}
	}
	return true
}

type execResult struct {
	changes   int64
	lastRowID int64
}

func (r execResult) LastInsertId() (int64, error) { return r.lastRowID, nil }

func (r execResult) RowsAffected() (int64, error) { return r.changes, nil }

// deferredResult is returned for writes buffered inside a transaction; their
// counters are unknown until the batch commits.
type deferredResult struct{}

func (deferredResult) LastInsertId() (int64, error) {
	return 0, errors.New("d1: last insert id is unavailable for writes buffered in a transaction")
}

func (deferredResult) RowsAffected() (int64, error) {
	return 0, errors.New("d1: rows affected is unavailable for writes buffered in a transaction")
}

type rows struct {
	result *result
	index  int
}

func (r *rows) Columns() []string {
	return r.result.Columns
}

func (*rows) Close() error { return nil }

func (r *rows) Next(dest []driver.Value) error {
	if r.index >= len(r.result.Rows) {
		return io.EOF
	}
	row := r.result.Rows[r.index]
	r.index++
	for i := range dest {
		if i < len(row) {
			dest[i] = row[i]
		} else {
			dest[i] = nil
		}
	}
	return nil
}

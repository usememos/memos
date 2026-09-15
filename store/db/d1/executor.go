package d1

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"
)

var protojsonUnmarshaler = protojson.UnmarshalOptions{
	DiscardUnknown: true,
}

// inClauseBatchSize keeps every IN (...) list under D1's 100 bound parameter
// limit, leaving room for the other bindings a statement carries.
const inClauseBatchSize = 90

// querier is the read surface shared by the driver methods.
type querier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

// batch is an ordered set of statements committed atomically. Statements are
// appended with add and conditions with guard; commit sends them in one
// request.
type batch struct {
	stmts []statement
}

func newBatch() *batch {
	return &batch{}
}

// add appends a statement and returns its index in the results.
func (b *batch) add(sql string, args ...any) int {
	b.stmts = append(b.stmts, statement{SQL: sql, Args: args})
	return len(b.stmts) - 1
}

// guard appends an assertion that aborts the whole batch when condition is
// false. condition is a SQL boolean expression using ? placeholders.
func (b *batch) guard(condition string, args ...any) {
	b.stmts = append(b.stmts, guardStatement(condition, args...))
}

// commit executes the batch atomically and returns one result per statement.
func (b *batch) commit(ctx context.Context, d *DB) ([]*result, error) {
	return d.client.batch(ctx, b.stmts)
}

// execOne runs a single write outside any batch.
func (d *DB) execOne(ctx context.Context, sql string, args ...any) (*result, error) {
	return d.client.exec(ctx, statement{SQL: sql, Args: args})
}

// placeholders returns n comma separated ? markers.
func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

// inClause renders "(?, ?, ...)" for values and appends them to args.
func inClause[T any](values []T) (string, []any) {
	args := make([]any, 0, len(values))
	for _, value := range values {
		args = append(args, value)
	}
	return "(" + placeholders(len(values)) + ")", args
}

// intList renders trusted integer ids as a literal IN list. Inlining them
// keeps long id lists under D1's 100 bound parameter limit.
func intList(ids []int32) string {
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		parts = append(parts, strconv.FormatInt(int64(id), 10))
	}
	return "(" + strings.Join(parts, ", ") + ")"
}

// chunk splits values into slices of at most size elements.
func chunk[T any](values []T, size int) [][]T {
	if len(values) == 0 {
		return nil
	}
	if size <= 0 {
		size = len(values)
	}
	chunks := make([][]T, 0, (len(values)+size-1)/size)
	for start := 0; start < len(values); start += size {
		end := min(start+size, len(values))
		chunks = append(chunks, values[start:end])
	}
	return chunks
}

// appendLimit adds LIMIT/OFFSET clauses when present.
func appendLimit(query string, limit, offset *int) string {
	if limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *limit)
		if offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *offset)
		}
	}
	return query
}

// requireChanges returns ErrMemoMutationConflict-style failures via the
// supplied error when a batch statement touched a different number of rows
// than expected.
func requireChanges(results []*result, index int, expected int64, conflict error) error {
	if index < 0 || index >= len(results) {
		return errors.Errorf("d1: batch result %d is out of range", index)
	}
	if results[index].Changes != expected {
		return conflict
	}
	return nil
}

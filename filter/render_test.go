package filter

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Callers append their own predicates after the filter fragment and bind
// positionally, so an argument left behind by a folded-away operand would bind
// to the caller's next placeholder. Folded operands must take their arguments
// with them.
func TestRenderFoldedOperandsDropTheirArgs(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	tests := []struct {
		filter string
		sql    string // "" for trivially true, "1 = 0" for unsatisfiable, "*" for any non-constant fragment
		args   []any
	}{
		{filter: `creator_id == 1 || true`, sql: "", args: []any{}},
		{filter: `true || creator_id == 1`, sql: "", args: []any{}},
		{filter: `creator_id == 1 && false`, sql: "1 = 0", args: []any{}},
		{filter: `false && creator_id == 1`, sql: "1 = 0", args: []any{}},
		{filter: `!(creator_id == 1 || true)`, sql: "1 = 0", args: []any{}},
		{filter: `!(creator_id == 1 && false)`, sql: "", args: []any{}},
		{filter: `(creator_id == 1 || true) && visibility == "PUBLIC"`, sql: "*", args: []any{"PUBLIC"}},
		{filter: `visibility == "PUBLIC" && (creator_id == 1 || true)`, sql: "*", args: []any{"PUBLIC"}},
		{filter: `(creator_id == 1 && false) || visibility == "PUBLIC"`, sql: "*", args: []any{"PUBLIC"}},
		{filter: `visibility == "PUBLIC" || (creator_id == 1 && false)`, sql: "*", args: []any{"PUBLIC"}},
		{filter: `!(creator_id == 1 || true) || visibility == "PUBLIC"`, sql: "*", args: []any{"PUBLIC"}},
		{filter: `(creator_id == 1 && true) || (tags.exists(t, t == "a") && false)`, sql: "*", args: []any{int64(1)}},
		{
			filter: `(visibility == "PRIVATE" || true) && (creator_id == 1 || true) && visibility == "PUBLIC" && creator_id == 2`,
			sql:    "*",
			args:   []any{"PUBLIC", int64(2)},
		},
	}

	for _, dialect := range []DialectName{DialectSQLite, DialectMySQL, DialectPostgres} {
		for _, offset := range []int{0, 3} {
			for _, tc := range tests {
				t.Run(fmt.Sprintf("%s/offset=%d/%s", dialect, offset, tc.filter), func(t *testing.T) {
					stmt, err := engine.CompileToStatement(context.Background(), tc.filter, RenderOptions{
						Dialect:           dialect,
						PlaceholderOffset: offset,
					})
					require.NoError(t, err)
					require.Equal(t, tc.args, stmt.Args)
					if tc.sql == "*" {
						require.NotContains(t, []string{"", "1 = 0"}, stmt.SQL)
					} else {
						require.Equal(t, tc.sql, stmt.SQL)
					}
					require.Equal(t, expectedPlaceholders(dialect, offset, len(tc.args)), placeholdersIn(dialect, stmt.SQL))
				})
			}
		}
	}
}

func TestCheckPlaceholderParityRejectsMismatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		dialect DialectName
		sql     string
		args    []any
		offset  int
		wantErr bool
	}{
		{name: "sqlite match", dialect: DialectSQLite, sql: "a = ? AND b = ?", args: []any{1, 2}},
		{name: "sqlite surplus arg", dialect: DialectSQLite, sql: "a = ?", args: []any{1, 2}, wantErr: true},
		{name: "mysql missing arg", dialect: DialectMySQL, sql: "a = ? AND b = ?", args: []any{1}, wantErr: true},
		{name: "postgres match with offset", dialect: DialectPostgres, sql: "a = $3 AND b = $4", args: []any{1, 2}, offset: 2},
		{name: "postgres surplus arg", dialect: DialectPostgres, sql: "a = $1", args: []any{1, 2}, wantErr: true},
		{name: "postgres below offset", dialect: DialectPostgres, sql: "a = $1", args: []any{1}, offset: 1, wantErr: true},
		{name: "postgres beyond args", dialect: DialectPostgres, sql: "a = $3", args: []any{1}, offset: 1, wantErr: true},
		{name: "postgres repeated", dialect: DialectPostgres, sql: "a = $1 AND b = $1", args: []any{1, 2}, wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := checkPlaceholderParity(tc.sql, tc.args, tc.dialect, tc.offset)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func expectedPlaceholders(dialect DialectName, offset, count int) []string {
	placeholders := []string{}
	for i := 1; i <= count; i++ {
		if dialect == DialectPostgres {
			placeholders = append(placeholders, fmt.Sprintf("$%d", offset+i))
		} else {
			placeholders = append(placeholders, "?")
		}
	}
	return placeholders
}

func placeholdersIn(dialect DialectName, sql string) []string {
	if dialect == DialectPostgres {
		matches := postgresPlaceholderPattern.FindAllString(sql, -1)
		if matches == nil {
			return []string{}
		}
		return matches
	}
	return expectedPlaceholders(dialect, 0, strings.Count(sql, "?"))
}

package filter

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Arithmetic folding: division and modulo
// ---------------------------------------------------------------------------

func TestCompileDivisionFolds(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	stmt, err := engine.CompileToStatement(context.Background(), `creator_id == 100 / 10`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(10)}, stmt.Args)
}

func TestCompileModuloFolds(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	stmt, err := engine.CompileToStatement(context.Background(), `creator_id == 17 % 5`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(2)}, stmt.Args)
}

func TestCompileDivisionByZeroErrors(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	_, err = engine.Compile(context.Background(), `creator_id == 10 / 0`)
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// size() on scalar string fields -> SQL length
// ---------------------------------------------------------------------------

func TestCompileSizeOnContentRendersLengthPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect  DialectName
		fragment string
	}{
		{DialectSQLite, "LENGTH("},
		{DialectPostgres, "LENGTH("},
		{DialectMySQL, "CHAR_LENGTH("},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `size(content) > 5`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		require.Contains(t, stmt.SQL, tc.fragment, "dialect %s", tc.dialect)
		require.Equal(t, []any{int64(5)}, stmt.Args, "dialect %s", tc.dialect)
	}
}

// ---------------------------------------------------------------------------
// Timestamp accessor methods (getFullYear, getMonth, ...)
// ---------------------------------------------------------------------------

func TestCompileTimestampAccessorsPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		name      string
		filter    string
		dialect   DialectName
		fragments []string
		arg       int64
	}{
		// getFullYear == 2024
		{"sqlite year", `created_ts.getFullYear() == 2024`, DialectSQLite, []string{"strftime('%Y'", "'unixepoch'"}, 2024},
		{"pg year", `created_ts.getFullYear() == 2024`, DialectPostgres, []string{"EXTRACT(YEAR FROM to_timestamp(", "AT TIME ZONE 'UTC'"}, 2024},
		{"mysql year", `created_ts.getFullYear() == 2024`, DialectMySQL, []string{"YEAR(`memo`.`created_ts`)"}, 2024},
		// getMonth is 0-based -> SQL must subtract 1
		{"sqlite month", `created_ts.getMonth() == 5`, DialectSQLite, []string{"strftime('%m'", "- 1)"}, 5},
		{"pg month", `created_ts.getMonth() == 5`, DialectPostgres, []string{"EXTRACT(MONTH FROM", "- 1)"}, 5},
		{"mysql month", `created_ts.getMonth() == 5`, DialectMySQL, []string{"MONTH(`memo`.`created_ts`)", "- 1)"}, 5},
		// getDayOfWeek 0=Sunday -> MySQL DAYOFWEEK is 1-based and must subtract 1
		{"mysql dow", `created_ts.getDayOfWeek() == 0`, DialectMySQL, []string{"DAYOFWEEK(`memo`.`created_ts`)", "- 1)"}, 0},
		{"sqlite dow", `created_ts.getDayOfWeek() == 0`, DialectSQLite, []string{"strftime('%w'"}, 0},
		// getDate is 1-based -> no offset
		{"sqlite date", `created_ts.getDate() == 22`, DialectSQLite, []string{"strftime('%d'"}, 22},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), tc.filter, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.name)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, tc.name)
		}
		require.Equal(t, []any{tc.arg}, stmt.Args, tc.name)
	}
}

func TestCompileTimestampAccessorRejectsTimezoneArg(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	_, err = engine.Compile(context.Background(), `created_ts.getHours("America/New_York") == 9`)
	require.Error(t, err)
}

func TestCompileTimestampAccessorRejectsNonTimestampField(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	// content is a string, not a timestamp.
	_, err = engine.Compile(context.Background(), `content.getFullYear() == 2024`)
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// ext.Sets(): sets.contains / sets.intersects / sets.equivalent over tags
// ---------------------------------------------------------------------------

func TestCompileSetsContainsRendersAndOfMemberships(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	stmt, err := engine.CompileToStatement(context.Background(), `sets.contains(tags, ["a", "b"])`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, " AND ")
	require.Len(t, stmt.Args, 2)
}

func TestCompileSetsIntersectsRendersOrOfMemberships(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	stmt, err := engine.CompileToStatement(context.Background(), `sets.intersects(tags, ["a", "b"])`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, " OR ")
	require.Len(t, stmt.Args, 2)
}

func TestCompileSetsEquivalentAddsLengthCheck(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	stmt, err := engine.CompileToStatement(context.Background(), `sets.equivalent(tags, ["a", "b"])`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "JSON_ARRAY_LENGTH")
	require.Contains(t, stmt.Args, int64(2))
}

// ---------------------------------------------------------------------------
// exists_one() comprehension on tags
// ---------------------------------------------------------------------------

func TestCompileExistsOnePerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"COUNT(", "json_each(", ") = 1"}},
		{DialectPostgres, []string{"COUNT(", "jsonb_array_elements_text(", ") = 1"}},
		{DialectMySQL, []string{"COUNT(", "JSON_TABLE(", ") = 1"}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `tags.exists_one(t, t == "urgent")`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, "dialect %s", tc.dialect)
		}
		require.Equal(t, []any{"urgent"}, stmt.Args, "dialect %s", tc.dialect)
	}
}

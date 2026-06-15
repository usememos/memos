package filter

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompileAcceptsStandardTagEqualityPredicate(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `tags.exists(t, t == "1231")`)
	require.NoError(t, err)
}

func TestCompileRejectsLegacyNumericLogicalOperand(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `pinned && 1`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to compile filter")
}

func TestCompileRejectsNonBooleanTopLevelConstant(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `1`)
	require.EqualError(t, err, "filter must evaluate to a boolean value")
}

func TestCompileRejectsMalformedRegex(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `content.matches("(")`)
	require.Error(t, err)
}

func TestCompileMatchesRendersRegexOperator(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(context.Background(), `content.matches("v[0-9]+")`, RenderOptions{Dialect: DialectPostgres})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "~")
	require.Equal(t, []any{"v[0-9]+"}, stmt.Args)
}

func TestCompileRejectsStartsWithOnUnsupportedField(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	_, err = engine.Compile(context.Background(), `visibility.startsWith("P")`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "does not support text matching")
}

func TestCompileContainsEscapesLikeWildcards(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	stmt, err := engine.CompileToStatement(context.Background(), `content.contains("50%_off")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	// The % and _ in the value must be escaped so they are matched literally,
	// and SQLite needs an explicit ESCAPE clause.
	require.Contains(t, stmt.SQL, `ESCAPE '\'`)
	require.Equal(t, []any{`%50\%\_off%`}, stmt.Args)
}

// =============================================================================
// Cross-dialect rendering tests (no DB required; complements the SQLite-only
// behavioral tests in store/test by asserting MySQL/Postgres SQL generation).
// =============================================================================

func TestRenderStartsWithPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"memos_unicode_lower(", "`memo`.`content`", `ESCAPE '\'`}},
		{DialectPostgres, []string{"memo.content ILIKE $1"}},
		{DialectMySQL, []string{"`memo`.`content` LIKE ?"}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `content.startsWith("TODO")`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, "dialect %s", tc.dialect)
		}
		require.Equal(t, []any{"TODO%"}, stmt.Args, "dialect %s", tc.dialect)
	}
}

func TestRenderEndsWithPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	for _, dialect := range []DialectName{DialectSQLite, DialectPostgres, DialectMySQL} {
		stmt, err := engine.CompileToStatement(context.Background(), `content.endsWith(".md")`, RenderOptions{Dialect: dialect})
		require.NoError(t, err, dialect)
		require.Equal(t, []any{"%.md"}, stmt.Args, "dialect %s", dialect)
	}
}

func TestRenderMatchesPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect  DialectName
		fragment string
	}{
		{DialectSQLite, "`memo`.`content` REGEXP ?"},
		{DialectMySQL, "`memo`.`content` REGEXP ?"},
		{DialectPostgres, "memo.content ~ $1"},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `content.matches("v[0-9]+")`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		require.Contains(t, stmt.SQL, tc.fragment, "dialect %s", tc.dialect)
		require.Equal(t, []any{"v[0-9]+"}, stmt.Args, "dialect %s", tc.dialect)
	}
}

func TestRenderTagsAllPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"NOT EXISTS", "json_each(", "!= '[]'", "memos_unicode_lower(value)"}},
		{DialectPostgres, []string{"NOT EXISTS", "jsonb_array_elements_text(", "jsonb_array_length(", "value ILIKE"}},
		{DialectMySQL, []string{"NOT EXISTS", "JSON_TABLE(", "JSON_LENGTH(", "value LIKE"}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `tags.all(t, t.startsWith("work/"))`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, "dialect %s", tc.dialect)
		}
		require.Equal(t, []any{"work/%"}, stmt.Args, "dialect %s", tc.dialect)
	}
}

func TestRenderTextMatchEscaping(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	// Both % and _ in the value must be escaped so they match literally.
	stmt, err := engine.CompileToStatement(context.Background(), `content.contains("a%b_c")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{`%a\%b\_c%`}, stmt.Args)
}

func TestRenderAllRejectsUnsupportedPredicate(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	// size() is not a valid per-element predicate inside all().
	_, err = engine.CompileToStatement(context.Background(), `tags.all(t, size(t) > 2)`, RenderOptions{Dialect: DialectSQLite})
	require.Error(t, err)
}

package filter

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"
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

func TestRenderTagMembershipIsExactPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	const tag = `work_%"quoted"`
	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"json_each(", "COLLATE BINARY"}},
		{DialectMySQL, []string{"JSON_TABLE(", "CAST(tag_item.value AS BINARY)"}},
		{DialectPostgres, []string{"jsonb_array_elements_text(", `(tag_item.value COLLATE "C")`}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `tag in ["work_%\"quoted\""]`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, fragment := range tc.fragments {
			require.Contains(t, stmt.SQL, fragment, tc.dialect)
		}
		require.NotContains(t, stmt.SQL, " LIKE ", tc.dialect)
		require.Equal(t, []any{tag}, stmt.Args, tc.dialect)
	}
}

func TestRenderTagExistsEqualityIsExactPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	const tag = `work_%"quoted"`
	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"json_each(", "COLLATE BINARY"}},
		{DialectMySQL, []string{"JSON_TABLE(", "CAST(tag_item.value AS BINARY)"}},
		{DialectPostgres, []string{"jsonb_array_elements_text(", `(tag_item.value COLLATE "C")`}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `tags.exists(t, t == "work_%\"quoted\"")`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, fragment := range tc.fragments {
			require.Contains(t, stmt.SQL, fragment, tc.dialect)
		}
		require.NotContains(t, stmt.SQL, " LIKE ", tc.dialect)
		require.Equal(t, []any{tag}, stmt.Args, tc.dialect)
	}
}

func TestRenderTagComprehensionEqualityIsExactAndUnboundedOnMySQL(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	for _, expression := range []string{`tags.all(t, t == "Work")`, `tags.exists_one(t, t == "Work")`} {
		stmt, err := engine.CompileToStatement(context.Background(), expression, RenderOptions{Dialect: DialectMySQL})
		require.NoError(t, err)
		require.Contains(t, stmt.SQL, "value LONGTEXT PATH '$'")
		require.Contains(t, stmt.SQL, "CAST(tag_item.value AS BINARY) = CAST(? AS BINARY)")
		require.NotContains(t, stmt.SQL, "VARCHAR(512)")
		require.Equal(t, []any{"Work"}, stmt.Args)
	}
}

func TestRenderTagComprehensionEqualityUsesBinaryPostgresCollation(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	for _, expression := range []string{`tags.all(t, t == "Work")`, `tags.exists_one(t, t == "Work")`} {
		stmt, err := engine.CompileToStatement(context.Background(), expression, RenderOptions{Dialect: DialectPostgres})
		require.NoError(t, err)
		require.Contains(t, stmt.SQL, `(tag_item.value COLLATE "C") = ($1::text COLLATE "C")`)
		require.Equal(t, []any{"Work"}, stmt.Args)
	}
}

func TestRenderTagStringPredicatesAreExactPerDialect(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	predicates := []struct {
		name        string
		expression  string
		sqliteSQL   string
		sqliteArgs  []any
		likePattern string
		usesLike    bool
	}{
		{name: "equals", expression: `t == "Work_%!"`, sqliteSQL: "COLLATE BINARY", sqliteArgs: []any{"Work_%!"}},
		{name: "startsWith", expression: `t.startsWith("Work_%!")`, sqliteSQL: "instr(tag_item.value, ?) = 1", sqliteArgs: []any{"Work_%!"}, likePattern: "Work!_!%!!%", usesLike: true},
		{name: "endsWith", expression: `t.endsWith("Work_%!")`, sqliteSQL: "substr(tag_item.value, -length(?))", sqliteArgs: []any{"Work_%!", "Work_%!"}, likePattern: "%Work!_!%!!", usesLike: true},
		{name: "contains", expression: `t.contains("Work_%!")`, sqliteSQL: "instr(tag_item.value, ?) > 0", sqliteArgs: []any{"Work_%!"}, likePattern: "%Work!_!%!!%", usesLike: true},
	}

	for _, comprehension := range []struct {
		kind        string
		sqlFragment string
	}{
		{kind: "exists", sqlFragment: "EXISTS (SELECT 1"},
		{kind: "all", sqlFragment: "NOT EXISTS (SELECT 1"},
		{kind: "exists_one", sqlFragment: "SELECT COUNT(*)"},
	} {
		for _, predicate := range predicates {
			expression := fmt.Sprintf("tags.%s(t, %s)", comprehension.kind, predicate.expression)
			t.Run(comprehension.kind+"/"+predicate.name, func(t *testing.T) {
				t.Parallel()

				sqliteStmt, err := engine.CompileToStatement(context.Background(), expression, RenderOptions{Dialect: DialectSQLite})
				require.NoError(t, err)
				require.Contains(t, sqliteStmt.SQL, "json_each(")
				require.Contains(t, sqliteStmt.SQL, comprehension.sqlFragment)
				require.Contains(t, sqliteStmt.SQL, predicate.sqliteSQL)
				require.NotContains(t, sqliteStmt.SQL, "memos_unicode_lower")
				require.Equal(t, predicate.sqliteArgs, sqliteStmt.Args)

				mysqlStmt, err := engine.CompileToStatement(context.Background(), expression, RenderOptions{Dialect: DialectMySQL})
				require.NoError(t, err)
				require.Contains(t, mysqlStmt.SQL, "JSON_TABLE(")
				require.Contains(t, mysqlStmt.SQL, comprehension.sqlFragment)
				require.Contains(t, mysqlStmt.SQL, "CAST(tag_item.value AS BINARY)")

				postgresStmt, err := engine.CompileToStatement(context.Background(), expression, RenderOptions{Dialect: DialectPostgres})
				require.NoError(t, err)
				require.Contains(t, postgresStmt.SQL, "jsonb_array_elements_text(")
				require.Contains(t, postgresStmt.SQL, comprehension.sqlFragment)
				require.Contains(t, postgresStmt.SQL, `(tag_item.value COLLATE "C")`)

				if predicate.usesLike {
					require.Contains(t, mysqlStmt.SQL, " LIKE ")
					require.Contains(t, mysqlStmt.SQL, "ESCAPE '!'")
					require.Contains(t, postgresStmt.SQL, " LIKE ")
					require.Contains(t, postgresStmt.SQL, "ESCAPE '!'")
					require.Equal(t, []any{predicate.likePattern}, mysqlStmt.Args)
					require.Equal(t, []any{predicate.likePattern}, postgresStmt.Args)
				} else {
					require.NotContains(t, mysqlStmt.SQL, " LIKE ")
					require.NotContains(t, postgresStmt.SQL, " LIKE ")
					require.Equal(t, []any{"Work_%!"}, mysqlStmt.Args)
					require.Equal(t, []any{"Work_%!"}, postgresStmt.Args)
				}
			})
		}
	}
}

func TestRenderEmptyTagListIsFalse(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	for _, dialect := range []DialectName{DialectSQLite, DialectMySQL, DialectPostgres} {
		stmt, err := engine.CompileToStatement(context.Background(), `tag in []`, RenderOptions{Dialect: dialect})
		require.NoError(t, err, dialect)
		require.Equal(t, "1 = 0", stmt.SQL, dialect)
		require.Empty(t, stmt.Args, dialect)
	}
}

func TestRenderTagStringPredicatesSQLiteBehavior(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	_, err = db.Exec(`CREATE TABLE memo (id INTEGER PRIMARY KEY, payload TEXT)`)
	require.NoError(t, err)
	for _, fixture := range []struct {
		id      int
		payload string
	}{
		{1, `{"tags":["Work_%done"]}`},
		{2, `{"tags":["work_%done"]}`},
		{3, `{"tags":["WorkX%done"]}`},
		{4, `{"tags":["Work_XXdone"]}`},
		{5, `{"tags":["Work_%done","other"]}`},
		{6, `{"tags":["Work_%done","Work_%done"]}`},
		{7, `{"tags":["preWork_%done"]}`},
		{8, `{"tags":["Work_%doneSuffix"]}`},
	} {
		_, err = db.Exec(`INSERT INTO memo (id, payload) VALUES (?, ?)`, fixture.id, fixture.payload)
		require.NoError(t, err)
	}

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	tests := []struct {
		name      string
		predicate string
		exists    []int
		all       []int
		existsOne []int
	}{
		{
			name:      "equality",
			predicate: `t == "Work_%done"`,
			exists:    []int{1, 5, 6},
			all:       []int{1, 6},
			existsOne: []int{1, 5},
		},
		{
			name:      "startsWith",
			predicate: `t.startsWith("Work_%done")`,
			exists:    []int{1, 5, 6, 8},
			all:       []int{1, 6, 8},
			existsOne: []int{1, 5, 8},
		},
		{
			name:      "endsWith",
			predicate: `t.endsWith("Work_%done")`,
			exists:    []int{1, 5, 6, 7},
			all:       []int{1, 6, 7},
			existsOne: []int{1, 5, 7},
		},
		{
			name:      "contains",
			predicate: `t.contains("Work_%done")`,
			exists:    []int{1, 5, 6, 7, 8},
			all:       []int{1, 6, 7, 8},
			existsOne: []int{1, 5, 7, 8},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			for _, comprehension := range []struct {
				name string
				want []int
			}{
				{name: "exists", want: tc.exists},
				{name: "all", want: tc.all},
				{name: "exists_one", want: tc.existsOne},
			} {
				t.Run(comprehension.name, func(t *testing.T) {
					stmt, err := engine.CompileToStatement(
						context.Background(),
						fmt.Sprintf("tags.%s(t, %s)", comprehension.name, tc.predicate),
						RenderOptions{Dialect: DialectSQLite},
					)
					require.NoError(t, err)
					require.Equal(t, comprehension.want, selectMemoIDs(t, db, stmt))
				})
			}
		})
	}
}

func selectMemoIDs(t *testing.T, db *sql.DB, stmt Statement) []int {
	t.Helper()

	rows, err := db.Query(`SELECT id FROM memo WHERE `+stmt.SQL+` ORDER BY id`, stmt.Args...)
	require.NoError(t, err)
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		require.NoError(t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(t, rows.Err())
	return ids
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
		args      []any
	}{
		{DialectSQLite, []string{"NOT EXISTS", "json_each(", "json_array_length(", "instr(tag_item.value, ?) = 1"}, []any{"work/"}},
		{DialectPostgres, []string{"NOT EXISTS", "jsonb_array_elements_text(", "jsonb_array_length(", `(tag_item.value COLLATE "C") LIKE`}, []any{"work/%"}},
		{DialectMySQL, []string{"NOT EXISTS", "JSON_TABLE(", "JSON_LENGTH(", "CAST(tag_item.value AS BINARY) LIKE"}, []any{"work/%"}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), `tags.all(t, t.startsWith("work/"))`, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, "dialect %s", tc.dialect)
		}
		require.Equal(t, tc.args, stmt.Args, "dialect %s", tc.dialect)
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

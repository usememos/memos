package filter

import (
	"context"
	"testing"
	"time"

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

func TestCompileNowAccessorsFoldToInjectedClock(t *testing.T) {
	t.Parallel()

	// 2026-07-07T10:30:45Z, a Tuesday (year day 188).
	engine := memoEngineAt(t, time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())

	cases := []struct {
		name   string
		filter string
		args   []any
	}{
		{"on this day", `created_ts.getMonth() == now.getMonth() && created_ts.getDate() == now.getDate()`, []any{int64(6), int64(7)}},
		{"year", `created_ts.getFullYear() < now.getFullYear()`, []any{int64(2026)}},
		{"day of month", `created_ts.getDayOfMonth() == now.getDayOfMonth()`, []any{int64(6)}},
		{"day of week", `created_ts.getDayOfWeek() == now.getDayOfWeek()`, []any{int64(2)}},
		{"day of year", `created_ts.getDayOfYear() == now.getDayOfYear()`, []any{int64(187)}},
		{"clock parts", `created_ts.getHours() == now.getHours() || created_ts.getMinutes() == now.getMinutes() || created_ts.getSeconds() == now.getSeconds()`, []any{int64(10), int64(30), int64(45)}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), tc.filter, RenderOptions{Dialect: DialectSQLite})
		require.NoError(t, err, tc.name)
		require.Equal(t, tc.args, stmt.Args, tc.name)
	}
}

func TestCompileNowAccessorRejectsTimezoneArg(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	_, err = engine.Compile(context.Background(), `created_ts.getMonth() == now.getMonth("America/New_York")`)
	require.Error(t, err)
}

func TestCompileOnThisDayPerDialect(t *testing.T) {
	t.Parallel()

	const onThisDay = `created_ts.getMonth() == now.getMonth() && created_ts.getDate() == now.getDate()`
	engine := memoEngineAt(t, time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())

	cases := []struct {
		dialect   DialectName
		fragments []string
	}{
		{DialectSQLite, []string{"strftime('%m'", "strftime('%d'", "'unixepoch'"}},
		{DialectPostgres, []string{"EXTRACT(MONTH FROM", "EXTRACT(DAY FROM"}},
		{DialectMySQL, []string{"MONTH(`memo`.`created_ts`)", "DAYOFMONTH(`memo`.`created_ts`)"}},
	}
	for _, tc := range cases {
		stmt, err := engine.CompileToStatement(context.Background(), onThisDay, RenderOptions{Dialect: tc.dialect})
		require.NoError(t, err, tc.dialect)
		for _, frag := range tc.fragments {
			require.Contains(t, stmt.SQL, frag, "dialect %s", tc.dialect)
		}
		require.Equal(t, []any{int64(6), int64(7)}, stmt.Args, "dialect %s", tc.dialect)
	}
}

func TestCompileNowAccessorsAtBoundaryDates(t *testing.T) {
	t.Parallel()

	// Every accessor folded at calendar edges: year rollover, leap day, Sunday.
	allAccessors := `created_ts.getFullYear() == now.getFullYear() ` +
		`&& created_ts.getMonth() == now.getMonth() ` +
		`&& created_ts.getDate() == now.getDate() ` +
		`&& created_ts.getDayOfMonth() == now.getDayOfMonth() ` +
		`&& created_ts.getDayOfWeek() == now.getDayOfWeek() ` +
		`&& created_ts.getDayOfYear() == now.getDayOfYear() ` +
		`&& created_ts.getHours() == now.getHours() ` +
		`&& created_ts.getMinutes() == now.getMinutes() ` +
		`&& created_ts.getSeconds() == now.getSeconds()`

	cases := []struct {
		name  string
		clock time.Time
		// year, month, date, dayOfMonth, dayOfWeek, dayOfYear, hours, minutes, seconds
		args []any
	}{
		{
			"new year's eve",
			time.Date(2026, time.December, 31, 23, 59, 59, 0, time.UTC),
			[]any{int64(2026), int64(11), int64(31), int64(30), int64(4), int64(364), int64(23), int64(59), int64(59)},
		},
		{
			"new year's day",
			time.Date(2027, time.January, 1, 0, 0, 0, 0, time.UTC),
			[]any{int64(2027), int64(0), int64(1), int64(0), int64(5), int64(0), int64(0), int64(0), int64(0)},
		},
		{
			"leap day",
			time.Date(2028, time.February, 29, 12, 0, 0, 0, time.UTC),
			[]any{int64(2028), int64(1), int64(29), int64(28), int64(2), int64(59), int64(12), int64(0), int64(0)},
		},
		{
			"sunday",
			time.Date(2026, time.July, 5, 8, 15, 30, 0, time.UTC),
			[]any{int64(2026), int64(6), int64(5), int64(4), int64(0), int64(185), int64(8), int64(15), int64(30)},
		},
	}
	for _, tc := range cases {
		engine := memoEngineAt(t, tc.clock.Unix())
		stmt, err := engine.CompileToStatement(context.Background(), allAccessors, RenderOptions{Dialect: DialectSQLite})
		require.NoError(t, err, tc.name)
		require.Equal(t, tc.args, stmt.Args, tc.name)
	}
}

func TestCompileNowAccessorFoldsInUTC(t *testing.T) {
	t.Parallel()

	// A clock in UTC+8 at 05:00 on July 8 is still July 7, 21:00 in UTC;
	// folding must not leak the clock's zone.
	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	engine.nowFunc = func() time.Time {
		return time.Date(2026, time.July, 8, 5, 0, 0, 0, time.FixedZone("UTC+8", 8*3600))
	}

	stmt, err := engine.CompileToStatement(
		context.Background(),
		`created_ts.getDate() == now.getDate() && created_ts.getHours() == now.getHours()`,
		RenderOptions{Dialect: DialectSQLite},
	)
	require.NoError(t, err)
	require.Equal(t, []any{int64(7), int64(21)}, stmt.Args)
}

func TestCompileNowAccessorOnLeftSide(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())
	stmt, err := engine.CompileToStatement(context.Background(), `now.getMonth() == created_ts.getMonth()`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "strftime('%m'")
	require.Equal(t, []any{int64(6)}, stmt.Args)
}

func TestCompileNowAccessorMirrorsOrderingOperator(t *testing.T) {
	t.Parallel()

	// Swapping the literal to the right must flip < to > to keep the meaning.
	engine := memoEngineAt(t, time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())
	stmt, err := engine.CompileToStatement(context.Background(), `now.getHours() < created_ts.getHours()`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "> ?")
	require.Equal(t, []any{int64(10)}, stmt.Args)
}

func TestCompileNowAccessorAgainstLiteralFoldsToConstant(t *testing.T) {
	t.Parallel()

	// Both sides fold to literals; the comparison folds to a constant condition.
	engine := memoEngineAt(t, time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())

	// True → trivial filter (empty SQL, matches everything).
	stmt, err := engine.CompileToStatement(context.Background(), `now.getFullYear() >= 2026`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Empty(t, stmt.SQL)
	require.Empty(t, stmt.Args)

	// False → unsatisfiable filter.
	stmt, err = engine.CompileToStatement(context.Background(), `now.getFullYear() < 2026`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, "1 = 0", stmt.SQL)
	require.Empty(t, stmt.Args)
}

func TestCompileAttachmentNowAccessors(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewAttachmentSchema())
	require.NoError(t, err)
	engine.nowFunc = fixedClock(time.Date(2026, time.July, 7, 10, 30, 45, 0, time.UTC).Unix())

	stmt, err := engine.CompileToStatement(
		context.Background(),
		`create_time.getMonth() == now.getMonth() && create_time.getDate() == now.getDate()`,
		RenderOptions{Dialect: DialectSQLite},
	)
	require.NoError(t, err)
	require.Contains(t, stmt.SQL, "`attachment`.`created_ts`")
	require.Equal(t, []any{int64(6), int64(7)}, stmt.Args)
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

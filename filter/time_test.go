package filter

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// fixedClock returns a deterministic clock for asserting folded `now` values.
func fixedClock(epoch int64) func() time.Time {
	return func() time.Time { return time.Unix(epoch, 0) }
}

func memoEngineAt(t *testing.T, epoch int64) *Engine {
	t.Helper()
	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)
	engine.nowFunc = fixedClock(epoch)
	return engine
}

func TestCompileNowVariableFoldsToInjectedClock(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, 1750000000)
	stmt, err := engine.CompileToStatement(context.Background(), `created_ts >= now`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1750000000)}, stmt.Args)
}

func TestCompileNowFunctionIsRemoved(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewSchema())
	require.NoError(t, err)

	// now() was the legacy custom function; it is replaced by the `now` variable.
	_, err = engine.Compile(context.Background(), `created_ts >= now()`)
	require.Error(t, err)
}

func TestCompileNowMinusDurationFolds(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, 1750000000)
	stmt, err := engine.CompileToStatement(context.Background(), `created_ts >= now - duration("1h")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1750000000 - 3600)}, stmt.Args)
}

func TestCompileNowPlusDurationFolds(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, 1750000000)
	stmt, err := engine.CompileToStatement(context.Background(), `updated_ts < now + duration("24h")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1750000000 + 86400)}, stmt.Args)
}

func TestCompileAbsoluteTimestampStringFolds(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, 1750000000)
	stmt, err := engine.CompileToStatement(context.Background(), `created_ts >= timestamp("2025-01-01T00:00:00Z")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1735689600)}, stmt.Args)
}

func TestCompileTimestampFromEpochIntFolds(t *testing.T) {
	t.Parallel()

	// This is the shape the frontend date-range filter emits.
	engine := memoEngineAt(t, 1750000000)
	stmt, err := engine.CompileToStatement(context.Background(), `created_ts >= timestamp(1730000000)`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1730000000)}, stmt.Args)
}

func TestCompileInvalidDurationLiteralErrors(t *testing.T) {
	t.Parallel()

	engine := memoEngineAt(t, 1750000000)
	_, err := engine.Compile(context.Background(), `created_ts >= now - duration("garbage")`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duration")
}

func TestCompileAttachmentCreateTimeUsesNow(t *testing.T) {
	t.Parallel()

	engine, err := NewEngine(NewAttachmentSchema())
	require.NoError(t, err)
	engine.nowFunc = fixedClock(1750000000)

	stmt, err := engine.CompileToStatement(context.Background(), `create_time >= now - duration("24h")`, RenderOptions{Dialect: DialectSQLite})
	require.NoError(t, err)
	require.Equal(t, []any{int64(1750000000 - 86400)}, stmt.Args)
}

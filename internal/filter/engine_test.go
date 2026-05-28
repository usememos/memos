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

package sqlite

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRegexpFunctionMatches(t *testing.T) {
	require.NoError(t, ensureRegexpRegistered())

	re, err := compileRegexp(`^v\d+$`)
	require.NoError(t, err)
	require.True(t, re.MatchString("v12"))
	require.False(t, re.MatchString("version"))

	// Caching returns the same compiled instance.
	re2, err := compileRegexp(`^v\d+$`)
	require.NoError(t, err)
	require.Same(t, re, re2)

	_, err = compileRegexp(`(`)
	require.Error(t, err)
}

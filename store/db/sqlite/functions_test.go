package sqlite

import (
	"fmt"
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

func TestRegexpCacheStaysBounded(t *testing.T) {
	regexpCache.Clear()
	regexpCacheSize.Store(0)
	for i := range maxRegexpCacheEntries * 3 {
		_, err := compileRegexp(fmt.Sprintf(`^pattern-%d$`, i))
		require.NoError(t, err)
		require.LessOrEqual(t, regexpCacheSize.Load(), int64(maxRegexpCacheEntries))
	}
	count := 0
	regexpCache.Range(func(_, _ any) bool { count++; return true })
	require.LessOrEqual(t, count, maxRegexpCacheEntries)
}

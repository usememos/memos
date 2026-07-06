// Package sqlite provides SQLite driver implementation with custom functions.
// Custom functions are registered globally on first use to extend SQLite's
// limited ASCII-only text operations with proper Unicode support.
package sqlite

import (
	"database/sql/driver"
	"errors"
	"regexp"
	"sync"

	"golang.org/x/text/cases"
	msqlite "modernc.org/sqlite"
)

var (
	registerUnicodeLowerOnce sync.Once
	registerUnicodeLowerErr  error
	// unicodeFold provides Unicode case folding for case-insensitive comparisons.
	// It's safe to use concurrently and reused across all function calls.
	unicodeFold = cases.Fold()
)

// ensureUnicodeLowerRegistered registers the memos_unicode_lower custom function
// with SQLite. This function provides proper Unicode case folding for case-insensitive
// text comparisons, overcoming modernc.org/sqlite's lack of ICU extension.
//
// The function is registered once globally and is safe to call multiple times.
func ensureUnicodeLowerRegistered() error {
	registerUnicodeLowerOnce.Do(func() {
		registerUnicodeLowerErr = msqlite.RegisterScalarFunction("memos_unicode_lower", 1, func(_ *msqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			if len(args) == 0 || args[0] == nil {
				return nil, nil
			}
			switch v := args[0].(type) {
			case string:
				return unicodeFold.String(v), nil
			case []byte:
				return unicodeFold.String(string(v)), nil
			default:
				return v, nil
			}
		})
	})
	return registerUnicodeLowerErr
}

var (
	registerRegexpOnce sync.Once
	registerRegexpErr  error
	// regexpCache memoizes compiled patterns; keys are pattern strings.
	regexpCache sync.Map
)

// ensureRegexpRegistered registers a Go-backed `regexp(pattern, value)` scalar
// function so SQLite's `value REGEXP pattern` operator works (modernc.org/sqlite
// has no built-in implementation). Patterns use Go's RE2 syntax. Registered once
// globally; safe to call multiple times.
func ensureRegexpRegistered() error {
	registerRegexpOnce.Do(func() {
		registerRegexpErr = msqlite.RegisterScalarFunction("regexp", 2, func(_ *msqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			if len(args) != 2 || args[0] == nil || args[1] == nil {
				return int64(0), nil
			}
			pattern, ok := args[0].(string)
			if !ok {
				return nil, errors.New("regexp pattern must be a string")
			}
			var value string
			switch v := args[1].(type) {
			case string:
				value = v
			case []byte:
				value = string(v)
			default:
				return int64(0), nil
			}
			re, err := compileRegexp(pattern)
			if err != nil {
				return nil, err
			}
			if re.MatchString(value) {
				return int64(1), nil
			}
			return int64(0), nil
		})
	})
	return registerRegexpErr
}

// compileRegexp compiles and caches a RE2 pattern.
func compileRegexp(pattern string) (*regexp.Regexp, error) {
	if cached, ok := regexpCache.Load(pattern); ok {
		if re, ok := cached.(*regexp.Regexp); ok {
			return re, nil
		}
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	regexpCache.Store(pattern, re)
	return re, nil
}

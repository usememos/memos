// Package sqlite provides SQLite driver implementation with custom functions.
// Custom functions are registered globally on first use to extend SQLite's
// limited ASCII-only text operations with proper Unicode support.
package sqlite

import (
	"database/sql/driver"
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

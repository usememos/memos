package v1

import "github.com/usememos/memos/internal/identifier"

// identifierIsValidUsername exposes the shared username rule to tests in this
// package without importing the helper into non-test code.
func identifierIsValidUsername(username string) bool {
	return identifier.IsValidUsername(username)
}

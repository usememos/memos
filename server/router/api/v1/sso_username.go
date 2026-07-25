package v1

import (
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

const ssoUsernameFallbackAttempts = 5

// reservedUsernames are names that must never be auto-assigned from an external
// identity provider. A user-influenceable identifier (e.g. an OIDC
// preferred_username) claiming one of these on first login would squat a
// privileged or system-suggestive handle, so it falls back to a UUID instead.
var reservedUsernames = map[string]struct{}{
	"admin":         {},
	"administrator": {},
	"api":           {},
	"memos":         {},
	"root":          {},
	"support":       {},
	"system":        {},
}

// isReservedUsername reports whether username is reserved. The comparison is
// case-insensitive because some backends fold case on the username unique index.
func isReservedUsername(username string) bool {
	_, ok := reservedUsernames[strings.ToLower(strings.TrimSpace(username))]
	return ok
}

// deriveSSOUsername produces the local username for a new SSO-created user.
//
// UUID usernames are the fallback when the IdP identifier cannot safely be used
// as the local username, such as when it is invalid or already belongs to
// another local account.
func deriveSSOUsername() (string, error) {
	username := util.GenUUID()
	if err := validateWritableUsername(username); err != nil {
		return "", errors.Wrap(err, "generated UUID did not satisfy username constraints")
	}
	return username, nil
}

package v1

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

// deriveSSOUsername produces the local username for a new SSO-created user.
//
// The current policy is to use a standard UUID string directly. This keeps the
// username independent of IdP profile fields and avoids availability probes or
// retry loops around concurrent first-time logins.
func deriveSSOUsername() (string, error) {
	username := util.GenUUID()
	if err := validateWritableUsername(username); err != nil {
		return "", errors.Wrap(err, "generated UUID did not satisfy username constraints")
	}
	return username, nil
}

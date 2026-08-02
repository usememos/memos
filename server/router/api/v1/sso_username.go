package v1

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

const ssoUsernameFallbackAttempts = 5

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

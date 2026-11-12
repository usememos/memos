package api

import (
	"github.com/pkg/errors"

	coreuser "github.com/usememos/memos/core/user"
	"github.com/usememos/memos/internal/random"
)

const ssoUsernameFallbackAttempts = 5

// deriveSSOUsername produces the local username for a new SSO-created user.
//
// UUID usernames are the fallback when the IdP identifier cannot safely be used
// as the local username, such as when it is invalid or already belongs to
// another local account.
func deriveSSOUsername() (string, error) {
	username := random.UUID()
	if err := coreuser.ValidateUsername(username); err != nil {
		return "", errors.Wrap(err, "generated UUID did not satisfy username constraints")
	}
	return username, nil
}

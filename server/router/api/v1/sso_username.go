package v1

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/util"
)

// deriveSSOUsername produces the local username for a new SSO-created user.
//
// The current policy prefixes a UUID with a letter so the generated value
// follows the same AIP-compatible format as user-selected usernames.
func deriveSSOUsername() (string, error) {
	username := "user-" + util.GenUUID()
	if err := validateWritableUsername(username); err != nil {
		return "", errors.Wrap(err, "generated username did not satisfy username constraints")
	}
	return username, nil
}

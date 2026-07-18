package v1

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/store"
)

// BuildUserName returns the canonical public resource name for a user.
func BuildUserName(username string) string {
	return UserNamePrefix + username
}

func parseUsernameFromName(name string) (string, error) {
	tokens, err := GetNameParentTokens(name, UserNamePrefix)
	if err != nil {
		return "", err
	}
	username := tokens[0]
	if username == "" {
		return "", errors.Errorf("invalid user name %q", name)
	}
	return username, nil
}

func validateWritableUsername(username string) error {
	if !base.ResourceIDMatcher.MatchString(username) {
		return errors.New("invalid username: must be 1-63 characters, start with a lowercase letter, contain only lowercase letters, digits, or hyphens, and end with a letter or digit")
	}
	return nil
}

// ResolveUserByName resolves a username-based user resource name to a store user.
func ResolveUserByName(ctx context.Context, stores *store.Store, name string) (*store.User, error) {
	username, err := parseUsernameFromName(name)
	if err != nil {
		return nil, err
	}
	user, err := stores.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return nil, errors.Wrap(err, "resolve user by name: GetUser failed")
	}
	return user, nil
}

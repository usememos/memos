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

// ExtractUsernameFromName extracts the username token from a user resource name.
func ExtractUsernameFromName(name string) (string, error) {
	tokens, err := GetNameParentTokens(name, UserNamePrefix)
	if err != nil {
		return "", err
	}
	username := tokens[0]
	if username == "" {
		return "", errors.Errorf("invalid user name %q", name)
	}
	if err := validateUsername(username); err != nil {
		return "", err
	}
	return username, nil
}

func validateUsername(username string) error {
	if username == "" || isNumericUsername(username) || !base.UIDMatcher.MatchString(username) {
		return errors.Errorf("invalid username %q", username)
	}
	return nil
}

func isNumericUsername(username string) bool {
	if username == "" {
		return false
	}
	for _, char := range username {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

// ResolveUserByName resolves a username-based user resource name to a store user.
func ResolveUserByName(ctx context.Context, stores *store.Store, name string) (*store.User, error) {
	username, err := ExtractUsernameFromName(name)
	if err != nil {
		return nil, err
	}
	user, err := stores.GetUser(ctx, &store.FindUser{Username: &username})
	if err != nil {
		return nil, errors.Wrap(err, "resolve user by name: GetUser failed")
	}
	return user, nil
}

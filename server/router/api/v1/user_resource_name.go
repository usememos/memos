package v1

import (
	"context"
	"strconv"
	"strings"

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
	if _, err := strconv.ParseInt(username, 10, 32); err == nil {
		return "", errors.Errorf("invalid username %q", username)
	}
	if username != strings.ToLower(username) || !base.UIDMatcher.MatchString(username) {
		return "", errors.Errorf("invalid username %q", username)
	}
	return username, nil
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

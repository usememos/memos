package v1

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/store"
)

// BuildUserName returns the canonical public resource name for a user.
//
// The returned value is of the form `users/<username>` and is the inverse of
// ExtractUsernameFromName for usernames that satisfy validateUsername.
func BuildUserName(username string) string {
	return UserNamePrefix + username
}

// ExtractUsernameFromName extracts the username token from a user resource name.
//
// The input is expected to match the canonical form `users/<username>`. The
// username segment is validated with validateUsernameForResourceName so rows
// already persisted with a non-strict username (e.g. SSO identifiers shaped
// like email addresses) remain addressable. Returns an error when the prefix
// is missing, the username segment is empty, or the relaxed validator rejects
// the value.
func ExtractUsernameFromName(name string) (string, error) {
	tokens, err := GetNameParentTokens(name, UserNamePrefix)
	if err != nil {
		return "", err
	}
	username := tokens[0]
	if username == "" {
		return "", errors.Errorf("invalid user name %q", name)
	}
	if err := validateUsernameForResourceName(username); err != nil {
		return "", err
	}
	return username, nil
}

// validateUsername enforces the strict username rules used when creating or
// renaming users.
//
// A username must be non-empty, must not consist solely of digits (to avoid
// clashing with numeric user IDs), and must match base.UIDMatcher. This is
// intentionally stricter than validateUsernameForResourceName.
func validateUsername(username string) error {
	if username == "" || isNumericUsername(username) || !base.UIDMatcher.MatchString(username) {
		return errors.Errorf("invalid username %q", username)
	}
	return nil
}

// validateUsernameForResourceName is the relaxed validator used when parsing
// an existing resource name.
//
// It rejects only values that would clearly make the resource name ambiguous
// or unparsable: empty strings, all-digit strings (which would collide with
// numeric IDs), and values containing a path separator. Everything else is
// trusted because the username has already been persisted via some other
// code path (for example SSO sign-in) and the store remains the source of
// truth for whether the row exists.
func validateUsernameForResourceName(username string) error {
	if username == "" || isNumericUsername(username) || strings.Contains(username, "/") {
		return errors.Errorf("invalid username %q", username)
	}
	return nil
}

// isNumericUsername reports whether username consists solely of decimal
// digits.
//
// An empty string is not considered numeric. It is used by both username
// validators to prevent collisions with numeric user IDs that are handled by
// ExtractUserIDFromName.
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

// ResolveUserByName resolves a username-based user resource name to a store
// user.
//
// It first parses the resource name with ExtractUsernameFromName and then
// looks up the row in the store. A nil user is returned without an error when
// the username is valid but no matching row exists.
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

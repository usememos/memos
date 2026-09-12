package store

import (
	stderrors "errors"
	"strings"

	"github.com/pkg/errors"
)

// ErrEmailTaken reports that another user already holds the email address.
var ErrEmailTaken = stderrors.New("email is already in use")

// ErrUsernameTaken reports that another user already holds the username.
var ErrUsernameTaken = stderrors.New("username is already in use")

// ErrUserIdentityTaken reports that an external identity linkage already
// exists, either for the same (provider, extern_uid) pair or for the same
// (user, provider) pair.
var ErrUserIdentityTaken = stderrors.New("user identity is already linked")

// uniqueViolationMarkers precede the constraint, index, or column name in the
// unique-violation message each supported driver emits:
//
//	SQLite:     UNIQUE constraint failed: user.email
//	MySQL:      Error 1062 (23000): Duplicate entry 'x' for key 'user.idx_user_email'
//	PostgreSQL: pq: duplicate key value violates unique constraint "idx_user_email"
//
// Classification looks only at the text after the marker so that a duplicate
// value such as a username spelled "email" cannot be mistaken for the index.
var uniqueViolationMarkers = []string{
	"UNIQUE constraint failed: ",
	" for key '",
	"violates unique constraint \"",
}

// classifyUserUniqueViolation maps a driver error raised by a write to the
// user or user_identity table onto one of the typed sentinels. It returns nil
// when the error is not a unique-constraint violation, so callers can fall
// through to their ordinary error handling.
func classifyUserUniqueViolation(err error) error {
	if err == nil {
		return nil
	}
	message := err.Error()
	for _, marker := range uniqueViolationMarkers {
		index := strings.Index(message, marker)
		if index < 0 {
			continue
		}
		target := message[index+len(marker):]
		switch {
		case strings.Contains(target, "user_identity"):
			return errors.Wrap(ErrUserIdentityTaken, message)
		case strings.Contains(target, "email"):
			return errors.Wrap(ErrEmailTaken, message)
		case strings.Contains(target, "username"):
			return errors.Wrap(ErrUsernameTaken, message)
		}
		return nil
	}
	return nil
}

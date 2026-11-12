// Package user holds the rules a user's sign-in fields must meet before they
// are stored, whichever path writes them, and its role's API and store forms.
package user

import (
	"strings"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/internal/identifier"
	"github.com/usememos/memos/internal/random"
	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

// NamePrefix starts every user resource name.
const NamePrefix = "users/"

// linkedIdentitiesSegment separates the user from the identity provider in a
// linked identity name.
const linkedIdentitiesSegment = "/linkedIdentities/"

// LinkedIdentityName is the resource name of the link between the user with
// username and the identity provider with uid provider:
// users/{user}/linkedIdentities/{idp}.
func LinkedIdentityName(username, provider string) string {
	return NamePrefix + username + linkedIdentitiesSegment + provider
}

// SplitLinkedIdentityName returns the username and identity provider uid a
// linked identity name joins, and whether name has that shape. It does not
// validate either part.
func SplitLinkedIdentityName(name string) (username, provider string, ok bool) {
	rest, ok := strings.CutPrefix(name, NamePrefix)
	if !ok {
		return "", "", false
	}
	return strings.Cut(rest, linkedIdentitiesSegment)
}

// RandomPasswordHash returns the hash of a password nobody knows, for an
// account that signs in through an identity provider and never with a password.
func RandomPasswordHash() (string, error) {
	password, err := random.String(20)
	if err != nil {
		return "", errors.Wrap(err, "failed to generate a random password")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", errors.Wrap(err, "failed to hash the password")
	}
	return string(hash), nil
}

// ValidateUsername reports whether username may be written as a new or
// changed username.
func ValidateUsername(username string) error {
	if !identifier.IsValidUsername(username) {
		return errors.Errorf("invalid username %q", username)
	}
	return nil
}

// ValidatePassword reports whether password may be set as a user's password.
func ValidatePassword(password string) error {
	if password == "" {
		return errors.New("password must not be empty")
	}
	return nil
}

// RoleToStore converts an API role for the store; anything but ADMIN is a
// regular user.
func RoleToStore(role apipb.User_Role) store.Role {
	if role == apipb.User_ADMIN {
		return store.RoleAdmin
	}
	return store.RoleUser
}

// RoleFromStore converts a stored role for the API.
func RoleFromStore(role store.Role) apipb.User_Role {
	switch role {
	case store.RoleAdmin:
		return apipb.User_ADMIN
	case store.RoleUser:
		return apipb.User_USER
	default:
		return apipb.User_ROLE_UNSPECIFIED
	}
}

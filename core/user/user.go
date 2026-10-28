// Package user holds the rules a user's sign-in fields must meet before they
// are stored, whichever path writes them, and its role's API and store forms.
package user

import (
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/identifier"
	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

// NamePrefix starts every user resource name.
const NamePrefix = "users/"

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

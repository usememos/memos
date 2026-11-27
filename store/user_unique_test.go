package store

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClassifyUserUniqueViolation(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    error
	}{
		{name: "sqlite email", message: "UNIQUE constraint failed: user.email", want: ErrEmailTaken},
		{name: "sqlite username", message: "UNIQUE constraint failed: user.username", want: ErrUsernameTaken},
		{name: "sqlite identity", message: "UNIQUE constraint failed: user_identity.provider, user_identity.extern_uid", want: ErrUserIdentityTaken},
		{name: "mysql email", message: "Error 1062 (23000): Duplicate entry 'a@b.c' for key 'user.idx_user_email'", want: ErrEmailTaken},
		{name: "mysql username", message: "Error 1062 (23000): Duplicate entry 'alice' for key 'user.username'", want: ErrUsernameTaken},
		{name: "mysql identity", message: "Error 1062 (23000): Duplicate entry 'idp-x' for key 'user_identity.provider'", want: ErrUserIdentityTaken},
		{name: "mysql identity value contains key marker", message: "Error 1062 (23000): Duplicate entry 'idp-x for key 'username' for key 'user_identity.provider'", want: ErrUserIdentityTaken},
		{name: "mysql username value contains key marker", message: "Error 1062 (23000): Duplicate entry 'x for key 'user_identity.provider' for key 'user.username'", want: ErrUsernameTaken},
		{name: "mariadb email", message: "Error 1062 (23000): Duplicate entry 'a@b.c' for key 'idx_user_email'", want: ErrEmailTaken},
		{name: "mariadb identity subject", message: "Error 1062 (23000): Duplicate entry 'idp-x' for key 'provider'", want: ErrUserIdentityTaken},
		{name: "mariadb identity value contains key marker", message: "Error 1062 (23000): Duplicate entry 'idp-x for key 'username' for key 'provider'", want: ErrUserIdentityTaken},
		{name: "mariadb identity value contains sqlite marker", message: "Error 1062 (23000): Duplicate entry 'idp-UNIQUE constraint failed: user.email' for key 'provider'", want: ErrUserIdentityTaken},
		{name: "mariadb identity value contains postgres marker", message: `Error 1062 (23000): Duplicate entry 'idp-violates unique constraint "idx_user_email"' for key 'provider'`, want: ErrUserIdentityTaken},
		{name: "mariadb identity user", message: "Error 1062 (23000): Duplicate entry '1-idp' for key 'user_id'", want: ErrUserIdentityTaken},
		{name: "identity key spelled as username", message: "Error 1062 (23000): Duplicate entry 'provider' for key 'username'", want: ErrUsernameTaken},
		{name: "unrelated qualified key", message: "Error 1062 (23000): Duplicate entry 'x' for key 'other.provider'", want: nil},
		{name: "postgres email", message: `pq: duplicate key value violates unique constraint "idx_user_email"`, want: ErrEmailTaken},
		{name: "postgres username", message: `pq: duplicate key value violates unique constraint "user_username_key"`, want: ErrUsernameTaken},
		{name: "postgres identity", message: `pq: duplicate key value violates unique constraint "user_identity_provider_extern_uid_key"`, want: ErrUserIdentityTaken},
		{name: "wrapped driver error", message: "failed to create user: UNIQUE constraint failed: user.email", want: ErrEmailTaken},
		{name: "username spelled email is still a username conflict", message: "Error 1062 (23000): Duplicate entry 'email' for key 'user.username'", want: ErrUsernameTaken},
		{name: "not a unique violation", message: "database is locked", want: nil},
		{name: "unique violation on another table", message: "UNIQUE constraint failed: memo.uid", want: nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := classifyUserUniqueViolation(errors.New(test.message))
			if test.want == nil {
				require.NoError(t, got)
				return
			}
			require.ErrorIs(t, got, test.want)
			require.Contains(t, got.Error(), test.message)
		})
	}
	require.NoError(t, classifyUserUniqueViolation(nil))
}

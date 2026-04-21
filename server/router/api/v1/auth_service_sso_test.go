package v1

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestResolveExistingSSOUser(t *testing.T) {
	t.Run("uses raw identifier when transform targets another existing username", func(t *testing.T) {
		lookups := []string{}
		rawUser := &store.User{Username: "alice@example.com"}

		user, err := resolveExistingSSOUser("alice@example.com", "alice", func(candidate string) (*store.User, error) {
			lookups = append(lookups, candidate)
			if candidate == "alice@example.com" {
				return rawUser, nil
			}
			return &store.User{Username: candidate}, nil
		})

		require.NoError(t, err)
		require.Equal(t, rawUser, user)
		require.Equal(t, []string{"alice@example.com"}, lookups)
	})

	t.Run("falls back to transformed username when raw identifier does not exist", func(t *testing.T) {
		lookups := []string{}
		transformedUser := &store.User{Username: "alice"}

		user, err := resolveExistingSSOUser("alice@example.com", "alice", func(candidate string) (*store.User, error) {
			lookups = append(lookups, candidate)
			if candidate == "alice" {
				return transformedUser, nil
			}
			return nil, nil
		})

		require.NoError(t, err)
		require.Equal(t, transformedUser, user)
		require.Equal(t, []string{"alice@example.com", "alice"}, lookups)
	})

	t.Run("performs a single lookup when no transform is active", func(t *testing.T) {
		lookups := []string{}
		rawUser := &store.User{Username: "alice"}

		user, err := resolveExistingSSOUser("alice", "alice", func(candidate string) (*store.User, error) {
			lookups = append(lookups, candidate)
			return rawUser, nil
		})

		require.NoError(t, err)
		require.Equal(t, rawUser, user)
		require.Equal(t, []string{"alice"}, lookups)
	})
}

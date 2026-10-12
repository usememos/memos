package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestUserEmailIsCanonical(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	user, err := ts.CreateUser(ctx, &store.User{Username: "alice", Role: store.RoleUser, Email: "  Alice@Example.COM "})
	require.NoError(t, err)
	require.Equal(t, "alice@example.com", user.Email)

	fetched, err := ts.GetUser(ctx, &store.FindUser{ID: &user.ID})
	require.NoError(t, err)
	require.Equal(t, "alice@example.com", fetched.Email)

	mixedCase := "ALICE@example.com"
	byEmail, err := ts.GetUser(ctx, &store.FindUser{Email: &mixedCase})
	require.NoError(t, err)
	require.NotNil(t, byEmail)
	require.Equal(t, user.ID, byEmail.ID)

	updatedEmail := " Alice.Two@Example.com "
	updated, err := ts.UpdateUser(ctx, &store.UpdateUser{ID: user.ID, Email: &updatedEmail})
	require.NoError(t, err)
	require.Equal(t, "alice.two@example.com", updated.Email)

	malformed := "not an address"
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: user.ID, Email: &malformed})
	require.Error(t, err)
	_, err = ts.CreateUser(ctx, &store.User{Username: "junk", Role: store.RoleUser, Email: "Alice <alice@example.com>"})
	require.Error(t, err)
}

func TestUserEmailIsUnique(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	first, err := ts.CreateUser(ctx, &store.User{Username: "first", Role: store.RoleUser, Email: "shared@example.com"})
	require.NoError(t, err)

	_, err = ts.CreateUser(ctx, &store.User{Username: "second", Role: store.RoleUser, Email: "Shared@Example.com"})
	require.ErrorIs(t, err, store.ErrEmailTaken)

	second, err := ts.CreateUser(ctx, &store.User{Username: "second", Role: store.RoleUser, Email: "second@example.com"})
	require.NoError(t, err)

	taken := "SHARED@example.com"
	_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: second.ID, Email: &taken})
	require.ErrorIs(t, err, store.ErrEmailTaken)

	// Clearing the address frees it for another account.
	none := ""
	cleared, err := ts.UpdateUser(ctx, &store.UpdateUser{ID: first.ID, Email: &none})
	require.NoError(t, err)
	require.Equal(t, "", cleared.Email)
	reclaimed, err := ts.UpdateUser(ctx, &store.UpdateUser{ID: second.ID, Email: &taken})
	require.NoError(t, err)
	require.Equal(t, "shared@example.com", reclaimed.Email)

	// A conflict on the email index is reported as such, not as a username conflict.
	_, err = ts.CreateUser(ctx, &store.User{Username: "first", Role: store.RoleUser, Email: "unique@example.com"})
	require.ErrorIs(t, err, store.ErrUsernameTaken)
}

func TestUserWithoutEmailIsNotUnique(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	for i := range 3 {
		user, err := ts.CreateUser(ctx, &store.User{Username: fmt.Sprintf("anon%d", i), Role: store.RoleUser, Email: ""})
		require.NoError(t, err)
		require.Equal(t, "", user.Email)
	}
	users, err := ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, users, 3)
	for _, user := range users {
		require.Equal(t, "", user.Email)
	}

	// Looking up "no address" matches nothing rather than every such user.
	empty := ""
	byEmpty, err := ts.ListUsers(ctx, &store.FindUser{Email: &empty})
	require.NoError(t, err)
	require.Empty(t, byEmpty)
}

func TestUserEmailConcurrentClaims(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	const attempts = 8
	var wg sync.WaitGroup
	results := make([]error, attempts)
	for i := range attempts {
		wg.Go(func() {
			_, results[i] = ts.CreateUser(ctx, &store.User{
				Username: fmt.Sprintf("racer%d", i),
				Role:     store.RoleUser,
				Email:    "race@example.com",
			})
		})
	}
	wg.Wait()

	successes := 0
	for _, err := range results {
		if err == nil {
			successes++
			continue
		}
		require.ErrorIs(t, err, store.ErrEmailTaken)
	}
	require.Equal(t, 1, successes)
}

package test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestCreateUserIfNoUsersConcurrentSetup(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	const attempts = 8
	users := make([]*store.User, attempts)
	created := make([]bool, attempts)
	errs := make([]error, attempts)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			<-start
			users[i], created[i], errs[i] = ts.CreateUserIfNoUsers(ctx, &store.User{
				Username: fmt.Sprintf("first-%d", i), Role: store.RoleAdmin,
				Email: fmt.Sprintf(" First%d@Example.COM ", i),
			})
		})
	}
	close(start)
	wg.Wait()
	var winner *store.User
	for i := range attempts {
		require.NoError(t, errs[i])
		if created[i] {
			require.Nil(t, winner, "only one first administrator may be created")
			winner = users[i]
			require.NotNil(t, winner)
			require.Equal(t, fmt.Sprintf("first%d@example.com", i), winner.Email)
		} else {
			require.Nil(t, users[i])
		}
	}
	require.NotNil(t, winner)
	persisted, err := ts.ListUsers(ctx, &store.FindUser{})
	require.NoError(t, err)
	require.Len(t, persisted, 1)
	require.Equal(t, winner.ID, persisted[0].ID)
	require.Equal(t, store.RoleAdmin, persisted[0].Role)
	cached, err := ts.GetUser(ctx, &store.FindUser{ID: &winner.ID})
	require.NoError(t, err)
	require.Equal(t, persisted[0], cached)
}

func TestCreateUserIfNoUsersFailureAllowsRetry(t *testing.T) {
	for _, name := range []string{"invalid email", "canceled context"} {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			create := &store.User{Username: "first", Role: store.RoleAdmin, Email: "first@example.com"}
			attemptCtx := ctx
			if name == "invalid email" {
				create.Email = "not an email"
			} else {
				canceled, cancel := context.WithCancel(ctx)
				cancel()
				attemptCtx = canceled
			}
			user, created, err := ts.CreateUserIfNoUsers(attemptCtx, create)
			require.Error(t, err)
			require.False(t, created)
			require.Nil(t, user)
			users, err := ts.ListUsers(ctx, &store.FindUser{})
			require.NoError(t, err)
			require.Empty(t, users)
			create.Email = "first@example.com"
			user, created, err = ts.CreateUserIfNoUsers(ctx, create)
			require.NoError(t, err)
			require.True(t, created)
			require.NotNil(t, user)
		})
	}
}

func TestCreateUserIfNoUsersRespectsExistingUser(t *testing.T) {
	for _, status := range []store.RowStatus{store.Normal, store.Archived} {
		t.Run(string(status), func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			defer ts.Close()
			existing, err := createTestingUserWithRole(ctx, ts, "existing", store.RoleUser)
			require.NoError(t, err)
			_, err = ts.UpdateUser(ctx, &store.UpdateUser{ID: existing.ID, RowStatus: &status})
			require.NoError(t, err)
			user, created, err := ts.CreateUserIfNoUsers(ctx, &store.User{Username: "new-admin", Role: store.RoleAdmin})
			require.NoError(t, err)
			require.False(t, created)
			require.Nil(t, user)
			users, err := ts.ListUsers(ctx, &store.FindUser{})
			require.NoError(t, err)
			require.Len(t, users, 1)
			require.Equal(t, existing.ID, users[0].ID)
			require.Equal(t, status, users[0].RowStatus)
		})
	}
}

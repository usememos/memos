package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apipb "github.com/usememos/memos/proto/gen/api"
)

func TestBatchGetUsersReturnsExactUsernamesWithoutAuthentication(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.CreateRegularUser(ctx, "batch-alpha")
	require.NoError(t, err)
	_, err = ts.CreateRegularUser(ctx, "batch-beta")
	require.NoError(t, err)

	resp, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
		Names: []string{"users/batch-alpha", "users/batch-beta", "users/missing-user", "users/batch-alpha"},
	})
	require.NoError(t, err)
	require.Len(t, resp.Users, 2)

	got := map[string]struct{}{}
	for _, user := range resp.Users {
		got[user.Username] = struct{}{}
	}
	_, ok := got["batch-alpha"]
	require.True(t, ok)
	_, ok = got["batch-beta"]
	require.True(t, ok)
}

func TestBatchGetUsersDoesNotNormalizeUsernames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.CreateRegularUser(ctx, "batch-alpha")
	require.NoError(t, err)

	resp, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
		Names: []string{"users/ batch-alpha "},
	})
	require.NoError(t, err)
	require.Empty(t, resp.Users)
}

func TestBatchGetUsersRejectsTooManyUsernames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	usernames := make([]string, 0, 101)
	for i := range 101 {
		usernames = append(usernames, fmt.Sprintf("users/user-%d", i))
	}

	_, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
		Names: usernames,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "too many names")
}

func TestBatchGetUsersRejectsTooManyNonEmptyUsernamesBeforeDedupe(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	usernames := make([]string, 0, 101)
	for range 101 {
		usernames = append(usernames, "users/legacy@example.com")
	}

	_, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
		Names: usernames,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "too many names")
}

func TestBatchGetUsersRejectsBareUsernames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.Service.BatchGetUsers(ctx, &apipb.BatchGetUsersRequest{
		Names: []string{"batch-alpha"},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid user name")
}

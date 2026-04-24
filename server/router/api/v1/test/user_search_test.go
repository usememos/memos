package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestBatchGetUsersReturnsExactUsernamesWithoutAuthentication(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.CreateRegularUser(ctx, "batch-alpha")
	require.NoError(t, err)
	_, err = ts.CreateRegularUser(ctx, "batch-beta")
	require.NoError(t, err)

	resp, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
		Usernames: []string{"batch-alpha", "batch-beta", "missing-user", "batch-alpha"},
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

func TestBatchGetUsersRejectsTooManyUsernames(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	usernames := make([]string, 0, 101)
	for i := range 101 {
		usernames = append(usernames, fmt.Sprintf("user-%d", i))
	}

	_, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
		Usernames: usernames,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "too many usernames")
}

func TestBatchGetUsersRejectsTooManyNonEmptyUsernamesBeforeDedupe(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	usernames := make([]string, 0, 101)
	for range 101 {
		usernames = append(usernames, "legacy@example.com")
	}

	_, err := ts.Service.BatchGetUsers(ctx, &apiv1.BatchGetUsersRequest{
		Usernames: usernames,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "too many usernames")
}

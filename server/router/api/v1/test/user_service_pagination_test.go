package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

// drainListUsers walks every page of ListUsers and returns the concatenated users.
func drainListUsers(ctx context.Context, t *testing.T, ts *TestService, pageSize int32) []*apiv1.User {
	t.Helper()
	var all []*apiv1.User
	pageToken := ""
	for {
		resp, err := ts.Service.ListUsers(ctx, &apiv1.ListUsersRequest{
			PageSize:  pageSize,
			PageToken: pageToken,
		})
		require.NoError(t, err)
		all = append(all, resp.Users...)
		if resp.NextPageToken == "" {
			break
		}
		pageToken = resp.NextPageToken
		require.LessOrEqual(t, len(all), 1000, "pagination did not terminate")
	}
	return all
}

func TestListUsersPagination(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	// Admin + 5 members = 6 users total.
	expected := map[string]struct{}{"admin": {}}
	for i := 0; i < 5; i++ {
		name := fmt.Sprintf("member-%d", i)
		_, err := ts.CreateRegularUser(ctx, name)
		require.NoError(t, err)
		expected[name] = struct{}{}
	}

	// A partial first page must carry a next page token.
	first, err := ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{PageSize: 2})
	require.NoError(t, err)
	require.Len(t, first.Users, 2)
	require.NotEmpty(t, first.NextPageToken)

	// Walking every page must yield each user exactly once (no overlap, no gaps).
	all := drainListUsers(adminCtx, t, ts, 2)
	seen := map[string]struct{}{}
	for _, u := range all {
		_, dup := seen[u.Username]
		require.False(t, dup, "user %s returned on multiple pages", u.Username)
		seen[u.Username] = struct{}{}
	}
	require.Equal(t, expected, seen)
}

func TestListUsersDefaultPageSizeReturnsAllWhenSmall(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	for i := 0; i < 3; i++ {
		_, err := ts.CreateRegularUser(ctx, fmt.Sprintf("member-%d", i))
		require.NoError(t, err)
	}

	// With no page size or token the default (50) exceeds the 4 users, so a
	// single page returns everyone and omits the next page token. This is the
	// path the admin members UI relies on.
	resp, err := ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{})
	require.NoError(t, err)
	require.Len(t, resp.Users, 4)
	require.Empty(t, resp.NextPageToken)
}

func TestListUsersInvalidPageToken(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	_, err = ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{PageToken: "not-a-valid-token"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid page token")
}

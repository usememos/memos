package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestListUsersPagination(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create admin user.
	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	// Create additional users.
	for i := 0; i < 5; i++ {
		_, err := ts.CreateHostUser(ctx, fmt.Sprintf("user-%d", i))
		require.NoError(t, err)
	}

	// First page.
	firstPage, err := ts.Service.ListUsers(adminCtx, &v1pb.ListUsersRequest{
		PageSize: 2,
	})
	require.NoError(t, err)
	require.Len(t, firstPage.Users, 2)
	require.Equal(t, int32(6), firstPage.TotalSize)
	require.NotEmpty(t, firstPage.NextPageToken)

	// Second page.
	secondPage, err := ts.Service.ListUsers(adminCtx, &v1pb.ListUsersRequest{
		PageSize:  2,
		PageToken: firstPage.NextPageToken,
	})
	require.NoError(t, err)
	require.Len(t, secondPage.Users, 2)
	require.Equal(t, int32(6), secondPage.TotalSize)
	require.NotEqual(t, firstPage.NextPageToken, secondPage.NextPageToken)

	// Third page.
	thirdPage, err := ts.Service.ListUsers(adminCtx, &v1pb.ListUsersRequest{
		PageSize:  2,
		PageToken: secondPage.NextPageToken,
	})
	require.NoError(t, err)
	require.Len(t, thirdPage.Users, 2)
	require.Equal(t, int32(6), thirdPage.TotalSize)
	require.Empty(t, thirdPage.NextPageToken)
}

func TestListUsersInvalidPageToken(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	_, err = ts.Service.ListUsers(adminCtx, &v1pb.ListUsersRequest{
		PageToken: "abc",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid page token")
}

func TestListUsersPageTokenOutOfRange(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	admin, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	_, err = ts.CreateHostUser(ctx, "user1")
	require.NoError(t, err)

	_, err = ts.Service.ListUsers(adminCtx, &v1pb.ListUsersRequest{
		PageToken: "999",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid page token")
}

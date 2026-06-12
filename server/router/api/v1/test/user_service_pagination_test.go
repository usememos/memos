package test

import (
	"context"
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestListUsersPaginates(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create 3 users
	for i := 0; i < 3; i++ {
		_, err := ts.CreateRegularUser(ctx, fmt.Sprintf("pagination-user-%d", i))
		require.NoError(t, err)
	}

	admin, err := ts.CreateAdminUser(ctx, "admin-paginator")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)

	// Fetch first page, limited to 2
	firstPage, err := ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{PageSize: 2})
	require.NoError(t, err)
	require.NotEmpty(t, firstPage.NextPageToken)

	// Fetch second page
	secondPage, err := ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{
		PageSize: 2,
		PageToken: firstPage.NextPageToken,
	})
	require.NoError(t, err)
	require.NotEmpty(t, secondPage.Users)
	
	// Negative offset test
	pageTokenBytes, err := proto.Marshal(&apiv1.PageToken{Offset: -1})
	require.NoError(t, err)
	badToken := base64.StdEncoding.EncodeToString(pageTokenBytes)

	_, err = ts.Service.ListUsers(adminCtx, &apiv1.ListUsersRequest{
		PageToken: badToken,
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "offset must not be negative")
}

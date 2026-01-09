package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestListActivities(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create userOne
	userOne, err := ts.CreateRegularUser(ctx, "test-user-1")
	require.NoError(t, err)
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	// Create userTwo
	userTwo, err := ts.CreateRegularUser(ctx, "test-user-2")
	require.NoError(t, err)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	// UserOne creates a memo
	memo, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content: "Base memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	// UserTwo creates 15 comments on the memo to generate 15 activities
	for i := 0; i < 15; i++ {
		_, err := ts.Service.CreateMemoComment(userTwoCtx, &apiv1.CreateMemoCommentRequest{
			Name: memo.Name,
			Comment: &apiv1.Memo{
				Content: fmt.Sprintf("Comment %d", i),
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
	}

	// List activities with page size 10 (as admin or userOne)
	// Activities are visible to the receiver (UserOne)
	resp, err := ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{
		PageSize: 10,
	})
	require.NoError(t, err)
	require.Len(t, resp.Activities, 10)
	require.NotEmpty(t, resp.NextPageToken)

	// List next page
	resp, err = ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{
		PageSize:  10,
		PageToken: resp.NextPageToken,
	})
	require.NoError(t, err)
	require.Len(t, resp.Activities, 5)
	require.Empty(t, resp.NextPageToken)
}

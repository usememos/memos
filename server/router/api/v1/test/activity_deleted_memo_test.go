package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	v1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

// TestListActivitiesWithDeletedMemos verifies that ListActivities gracefully handles
// activities that reference deleted memos instead of crashing the entire request.
func TestListActivitiesWithDeletedMemos(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create two users - one to create memo, one to comment
	userOne, err := ts.CreateRegularUser(ctx, "test-user-1")
	require.NoError(t, err)
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	userTwo, err := ts.CreateRegularUser(ctx, "test-user-2")
	require.NoError(t, err)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	// Create a memo by userOne
	memo1, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Original memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo1)

	// Create a comment on the memo by userTwo (this will create an activity for userOne)
	comment, err := ts.Service.CreateMemoComment(userTwoCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo1.Name,
		Comment: &apiv1.Memo{
			Content:    "This is a comment",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, comment)

	// Verify activity was created for the comment (check from userOne's perspective - they receive the notification)
	activities, err := ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	initialActivityCount := len(activities.Activities)
	require.Greater(t, initialActivityCount, 0, "Should have at least one activity")

	// Delete the original memo (this deletes the comment too)
	_, err = ts.Service.DeleteMemo(userOneCtx, &apiv1.DeleteMemoRequest{
		Name: memo1.Name,
	})
	require.NoError(t, err)

	// List activities again - should succeed even though the memo is deleted
	activities, err = ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	// Activities list should be empty or not contain the deleted memo activity
	for _, activity := range activities.Activities {
		if activity.Payload != nil && activity.Payload.GetMemoComment() != nil {
			require.NotEqual(t, memo1.Name, activity.Payload.GetMemoComment().Memo,
				"Activity should not reference deleted memo")
		}
	}
	// After deletion, there should be fewer activities
	require.LessOrEqual(t, len(activities.Activities), initialActivityCount-1,
		"Should have filtered out the activity for the deleted memo")
}

// TestGetActivityWithDeletedMemo verifies that GetActivity returns a proper error
// when trying to fetch an activity that references a deleted memo.
func TestGetActivityWithDeletedMemo(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create two users
	userOne, err := ts.CreateRegularUser(ctx, "test-user-1")
	require.NoError(t, err)
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	userTwo, err := ts.CreateRegularUser(ctx, "test-user-2")
	require.NoError(t, err)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	// Create a memo by userOne
	memo1, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Original memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo1)

	// Create a comment to trigger activity creation by userTwo
	comment, err := ts.Service.CreateMemoComment(userTwoCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo1.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, comment)

	// Get the activity ID by listing activities from userOne's perspective
	activities, err := ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	require.Greater(t, len(activities.Activities), 0)

	activityName := activities.Activities[0].Name

	// Delete the memo
	_, err = ts.Service.DeleteMemo(userOneCtx, &apiv1.DeleteMemoRequest{
		Name: memo1.Name,
	})
	require.NoError(t, err)

	// Try to get the specific activity - should return NotFound error
	_, err = ts.Service.GetActivity(userOneCtx, &apiv1.GetActivityRequest{
		Name: activityName,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "activity references deleted content")
}

// TestActivitiesWithPartiallyDeletedMemos verifies that when some memos are deleted,
// other valid activities are still returned.
func TestActivitiesWithPartiallyDeletedMemos(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create two users
	userOne, err := ts.CreateRegularUser(ctx, "test-user-1")
	require.NoError(t, err)
	userOneCtx := ts.CreateUserContext(ctx, userOne.ID)

	userTwo, err := ts.CreateRegularUser(ctx, "test-user-2")
	require.NoError(t, err)
	userTwoCtx := ts.CreateUserContext(ctx, userTwo.ID)

	// Create two memos by userOne
	memo1, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "First memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	memo2, err := ts.Service.CreateMemo(userOneCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Second memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	// Create comments on both by userTwo (creates activities for userOne)
	_, err = ts.Service.CreateMemoComment(userTwoCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo1.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment on first",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(userTwoCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo2.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment on second",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	// Should have 2 activities from userOne's perspective
	activities, err := ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	require.Equal(t, 2, len(activities.Activities))

	// Delete first memo
	_, err = ts.Service.DeleteMemo(userOneCtx, &apiv1.DeleteMemoRequest{
		Name: memo1.Name,
	})
	require.NoError(t, err)

	// List activities - should still work and return only the second memo's activity
	activities, err = ts.Service.ListActivities(userOneCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	require.Equal(t, 1, len(activities.Activities), "Should have 1 activity remaining")

	// Verify the remaining activity relates to a valid memo
	require.NotNil(t, activities.Activities[0].Payload.GetMemoComment())
	require.Contains(t, activities.Activities[0].Payload.GetMemoComment().RelatedMemo, "memos/")
}

// TestActivityStoreDirectDeletion tests the scenario where a memo is deleted directly
// from the store (simulating database-level deletion or migration).
func TestActivityStoreDirectDeletion(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "test-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Create a memo
	memo1, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Test memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	// Create a comment
	comment, err := ts.Service.CreateMemoComment(userCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo1.Name,
		Comment: &apiv1.Memo{
			Content:    "Test comment",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	// Extract memo UID from the comment name
	commentMemoUID, err := v1.ExtractMemoUIDFromName(comment.Name)
	require.NoError(t, err)

	commentMemo, err := ts.Store.GetMemo(ctx, &store.FindMemo{
		UID: &commentMemoUID,
	})
	require.NoError(t, err)
	require.NotNil(t, commentMemo)

	// Delete the comment memo directly from store (simulating orphaned activity)
	err = ts.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: commentMemo.ID})
	require.NoError(t, err)

	// List activities should still succeed even with orphaned activity
	activities, err := ts.Service.ListActivities(userCtx, &apiv1.ListActivitiesRequest{})
	require.NoError(t, err)
	// Activities should be empty or not include the orphaned one
	for _, activity := range activities.Activities {
		if activity.Payload != nil && activity.Payload.GetMemoComment() != nil {
			require.NotEqual(t, comment.Name, activity.Payload.GetMemoComment().Memo,
				"Should not return activity with deleted memo")
		}
	}
}

package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestGetUserStats_TagCount(t *testing.T) {
	ctx := context.Background()

	// Create test service
	ts := NewTestService(t)
	defer ts.Cleanup()

	// Create a test host user
	user, err := ts.CreateHostUser(ctx, "test_user")
	require.NoError(t, err)

	// Create user context for authentication
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Create a memo with a single tag
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-1",
		CreatorID:  user.ID,
		Content:    "This is a test memo with #test tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"test"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// Test GetUserStats
	userName := fmt.Sprintf("users/%d", user.ID)
	response, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response)

	// Check that the tag count is exactly 1, not 2
	require.Contains(t, response.TagCount, "test")
	require.Equal(t, int32(1), response.TagCount["test"], "Tag count should be 1 for a single occurrence")

	// Create another memo with the same tag
	memo2, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-2",
		CreatorID:  user.ID,
		Content:    "Another memo with #test tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"test"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo2)

	// Test GetUserStats again
	response2, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response2)

	// Check that the tag count is exactly 2, not 3
	require.Contains(t, response2.TagCount, "test")
	require.Equal(t, int32(2), response2.TagCount["test"], "Tag count should be 2 for two occurrences")

	// Test with a new unique tag
	memo3, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-3",
		CreatorID:  user.ID,
		Content:    "Memo with #unique tag",
		Visibility: store.Public,
		Payload: &storepb.MemoPayload{
			Tags: []string{"unique"},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, memo3)

	// Test GetUserStats for the new tag
	response3, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response3)

	// Check that the unique tag count is exactly 1
	require.Contains(t, response3.TagCount, "unique")
	require.Equal(t, int32(1), response3.TagCount["unique"], "New tag count should be 1 for first occurrence")

	// The original test tag should still be 2
	require.Contains(t, response3.TagCount, "test")
	require.Equal(t, int32(2), response3.TagCount["test"], "Original tag count should remain 2")
}

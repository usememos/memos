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
	user, err := ts.CreateHostUser(ctx, "test-user")
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
	userName := fmt.Sprintf("users/%s", user.Username)
	response, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: userName,
	})
	require.NoError(t, err)
	require.NotNil(t, response)
	require.Equal(t, fmt.Sprintf("users/%s/stats", user.Username), response.Name)

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

	_, err = ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{
		Name: "users/1",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "user not found")
}

func TestGetUserStats_MemoUpdatedTimestamps(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "ts-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "ts-memo-1",
		CreatorID:  user.ID,
		Content:    "first content",
		Visibility: store.Public,
	})
	require.NoError(t, err)
	require.NotNil(t, memo)

	// SQLite UpdateMemo only sets fields explicitly passed (created_ts default
	// fires on INSERT only). So bump updated_ts explicitly to simulate an edit
	// happening after creation.
	newContent := "second content"
	newUpdatedTs := memo.UpdatedTs + 100
	require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{
		ID:        memo.ID,
		Content:   &newContent,
		UpdatedTs: &newUpdatedTs,
	}))

	userName := fmt.Sprintf("users/%s", user.Username)
	resp, err := ts.Service.GetUserStats(userCtx, &v1pb.GetUserStatsRequest{Name: userName})
	require.NoError(t, err)
	require.NotNil(t, resp)

	require.Len(t, resp.MemoCreatedTimestamps, 1, "should have one created timestamp")
	require.Len(t, resp.MemoUpdatedTimestamps, 1, "should have one updated timestamp")

	require.Equal(t, memo.CreatedTs, resp.MemoCreatedTimestamps[0].AsTime().Unix())
	require.Equal(t, newUpdatedTs, resp.MemoUpdatedTimestamps[0].AsTime().Unix())
	require.Greater(
		t,
		resp.MemoUpdatedTimestamps[0].AsTime().Unix(),
		resp.MemoCreatedTimestamps[0].AsTime().Unix(),
		"updated_ts should be after created_ts after an edit",
	)
}

func TestListAllUserStats_FilterExcludesPrivateMemos(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateHostUser(ctx, "stats-filter-user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "stats-filter-public",
		CreatorID:  user.ID,
		Content:    "public memo",
		Visibility: store.Public,
		Payload:    &storepb.MemoPayload{Tags: []string{"public"}},
	})
	require.NoError(t, err)
	_, err = ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "stats-filter-private",
		CreatorID:  user.ID,
		Content:    "private memo",
		Visibility: store.Private,
		Payload:    &storepb.MemoPayload{Tags: []string{"private"}},
	})
	require.NoError(t, err)

	unfilteredResp, err := ts.Service.ListAllUserStats(userCtx, &v1pb.ListAllUserStatsRequest{})
	require.NoError(t, err)
	require.Len(t, unfilteredResp.Stats, 1)
	require.Equal(t, int32(1), unfilteredResp.Stats[0].TagCount["public"])
	require.Equal(t, int32(1), unfilteredResp.Stats[0].TagCount["private"])

	filteredResp, err := ts.Service.ListAllUserStats(userCtx, &v1pb.ListAllUserStatsRequest{
		Filter: `visibility in ["PUBLIC", "PROTECTED"]`,
	})
	require.NoError(t, err)
	require.Len(t, filteredResp.Stats, 1)
	require.Equal(t, int32(1), filteredResp.Stats[0].TagCount["public"])
	require.NotContains(t, filteredResp.Stats[0].TagCount, "private")
}

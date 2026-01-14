package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestActivityStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	create := &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	}
	activity, err := ts.CreateActivity(ctx, create)
	require.NoError(t, err)
	require.NotNil(t, activity)
	activities, err := ts.ListActivities(ctx, &store.FindActivity{
		ID: &activity.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(activities))
	require.Equal(t, activity, activities[0])
	ts.Close()
}

func TestActivityGetByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	// Get activity by ID
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, activity.ID, found.ID)

	// Get non-existent activity
	nonExistentID := int32(99999)
	notFound, err := ts.GetActivity(ctx, &store.FindActivity{ID: &nonExistentID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestActivityListMultiple(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create multiple activities
	_, err = ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	_, err = ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	// List all activities
	allActivities, err := ts.ListActivities(ctx, &store.FindActivity{})
	require.NoError(t, err)
	require.Equal(t, 2, len(allActivities))

	// List by type
	commentType := store.ActivityTypeMemoComment
	commentActivities, err := ts.ListActivities(ctx, &store.FindActivity{Type: &commentType})
	require.NoError(t, err)
	require.Equal(t, 2, len(commentActivities))
	require.Equal(t, store.ActivityTypeMemoComment, commentActivities[0].Type)

	ts.Close()
}

func TestActivityListByType(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create activities with MEMO_COMMENT type
	_, err = ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	_, err = ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	// List by type
	activityType := store.ActivityTypeMemoComment
	activities, err := ts.ListActivities(ctx, &store.FindActivity{Type: &activityType})
	require.NoError(t, err)
	require.Len(t, activities, 2)
	for _, activity := range activities {
		require.Equal(t, store.ActivityTypeMemoComment, activity.Type)
	}

	ts.Close()
}

func TestActivityPayloadMemoComment(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create activity with MemoComment payload
	memoID := int32(123)
	relatedMemoID := int32(456)
	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload: &storepb.ActivityPayload{
			MemoComment: &storepb.ActivityMemoCommentPayload{
				MemoId:        memoID,
				RelatedMemoId: relatedMemoID,
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, activity.Payload)
	require.NotNil(t, activity.Payload.MemoComment)
	require.Equal(t, memoID, activity.Payload.MemoComment.MemoId)
	require.Equal(t, relatedMemoID, activity.Payload.MemoComment.RelatedMemoId)

	// Verify payload is preserved when listing
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.NotNil(t, found.Payload.MemoComment)
	require.Equal(t, memoID, found.Payload.MemoComment.MemoId)
	require.Equal(t, relatedMemoID, found.Payload.MemoComment.RelatedMemoId)

	ts.Close()
}

func TestActivityEmptyPayload(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create activity with empty payload
	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)
	require.NotNil(t, activity.Payload)

	// Verify empty payload is handled correctly
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.NotNil(t, found.Payload)
	require.Nil(t, found.Payload.MemoComment)

	ts.Close()
}

func TestActivityLevel(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create activity with INFO level
	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)
	require.Equal(t, store.ActivityLevelInfo, activity.Level)

	// Verify level is preserved when listing
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.Equal(t, store.ActivityLevelInfo, found.Level)

	ts.Close()
}

func TestActivityCreatorID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create activity for user1
	activity1, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user1.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)
	require.Equal(t, user1.ID, activity1.CreatorID)

	// Create activity for user2
	activity2, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user2.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)
	require.Equal(t, user2.ID, activity2.CreatorID)

	// List all and verify creator IDs
	activities, err := ts.ListActivities(ctx, &store.FindActivity{})
	require.NoError(t, err)
	require.Len(t, activities, 2)

	ts.Close()
}

func TestActivityCreatedTs(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)
	require.NotZero(t, activity.CreatedTs)

	// Verify timestamp is preserved when listing
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.Equal(t, activity.CreatedTs, found.CreatedTs)

	ts.Close()
}

func TestActivityListEmpty(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// List activities when none exist
	activities, err := ts.ListActivities(ctx, &store.FindActivity{})
	require.NoError(t, err)
	require.Len(t, activities, 0)

	ts.Close()
}

func TestActivityListWithIDAndType(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload:   &storepb.ActivityPayload{},
	})
	require.NoError(t, err)

	// List with both ID and Type filters
	activityType := store.ActivityTypeMemoComment
	activities, err := ts.ListActivities(ctx, &store.FindActivity{
		ID:   &activity.ID,
		Type: &activityType,
	})
	require.NoError(t, err)
	require.Len(t, activities, 1)
	require.Equal(t, activity.ID, activities[0].ID)

	ts.Close()
}

func TestActivityPayloadComplexMemoComment(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create a memo first to use its ID
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "test-memo-for-activity",
		CreatorID:  user.ID,
		Content:    "Test memo content",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create comment memo
	commentMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        "comment-memo",
		CreatorID:  user.ID,
		Content:    "This is a comment",
		Visibility: store.Public,
	})
	require.NoError(t, err)

	// Create activity with real memo IDs
	activity, err := ts.CreateActivity(ctx, &store.Activity{
		CreatorID: user.ID,
		Type:      store.ActivityTypeMemoComment,
		Level:     store.ActivityLevelInfo,
		Payload: &storepb.ActivityPayload{
			MemoComment: &storepb.ActivityMemoCommentPayload{
				MemoId:        memo.ID,
				RelatedMemoId: commentMemo.ID,
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, memo.ID, activity.Payload.MemoComment.MemoId)
	require.Equal(t, commentMemo.ID, activity.Payload.MemoComment.RelatedMemoId)

	// Verify payload is preserved
	found, err := ts.GetActivity(ctx, &store.FindActivity{ID: &activity.ID})
	require.NoError(t, err)
	require.Equal(t, memo.ID, found.Payload.MemoComment.MemoId)
	require.Equal(t, commentMemo.ID, found.Payload.MemoComment.RelatedMemoId)

	ts.Close()
}

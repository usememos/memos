package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestActivityStore(t *testing.T) {
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

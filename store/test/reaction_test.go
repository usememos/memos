package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestReactionStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	contentID := "test_content_id"
	reaction, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    contentID,
		ReactionType: "💗",
	})
	require.NoError(t, err)
	require.NotNil(t, reaction)
	require.NotEmpty(t, reaction.ID)

	reactions, err := ts.ListReactions(ctx, &store.FindReaction{
		ContentID: &contentID,
	})
	require.NoError(t, err)
	require.Len(t, reactions, 1)
	require.Equal(t, reaction, reactions[0])

	// Test GetReaction.
	gotReaction, err := ts.GetReaction(ctx, &store.FindReaction{
		ID: &reaction.ID,
	})
	require.NoError(t, err)
	require.NotNil(t, gotReaction)
	require.Equal(t, reaction.ID, gotReaction.ID)
	require.Equal(t, reaction.CreatorID, gotReaction.CreatorID)
	require.Equal(t, reaction.ContentID, gotReaction.ContentID)
	require.Equal(t, reaction.ReactionType, gotReaction.ReactionType)

	// Test GetReaction with non-existent ID.
	nonExistentID := int32(99999)
	notFoundReaction, err := ts.GetReaction(ctx, &store.FindReaction{
		ID: &nonExistentID,
	})
	require.NoError(t, err)
	require.Nil(t, notFoundReaction)

	err = ts.DeleteReaction(ctx, &store.DeleteReaction{
		ID: reaction.ID,
	})
	require.NoError(t, err)

	reactions, err = ts.ListReactions(ctx, &store.FindReaction{
		ContentID: &contentID,
	})
	require.NoError(t, err)
	require.Len(t, reactions, 0)

	ts.Close()
}

func TestReactionListByCreatorID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	contentID := "shared_content"

	// User 1 creates reaction
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user1.ID,
		ContentID:    contentID,
		ReactionType: "👍",
	})
	require.NoError(t, err)

	// User 2 creates reaction
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user2.ID,
		ContentID:    contentID,
		ReactionType: "❤️",
	})
	require.NoError(t, err)

	// List all reactions for content
	reactions, err := ts.ListReactions(ctx, &store.FindReaction{
		ContentID: &contentID,
	})
	require.NoError(t, err)
	require.Len(t, reactions, 2)

	// List by creator ID
	user1Reactions, err := ts.ListReactions(ctx, &store.FindReaction{
		CreatorID: &user1.ID,
	})
	require.NoError(t, err)
	require.Len(t, user1Reactions, 1)
	require.Equal(t, "👍", user1Reactions[0].ReactionType)

	ts.Close()
}

func TestReactionMultipleContentIDs(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	contentID1 := "content_1"
	contentID2 := "content_2"

	// Create reactions for different contents
	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    contentID1,
		ReactionType: "👍",
	})
	require.NoError(t, err)

	_, err = ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    contentID2,
		ReactionType: "❤️",
	})
	require.NoError(t, err)

	// List by content ID list
	reactions, err := ts.ListReactions(ctx, &store.FindReaction{
		ContentIDList: []string{contentID1, contentID2},
	})
	require.NoError(t, err)
	require.Len(t, reactions, 2)

	ts.Close()
}

func TestReactionUpsertDifferentTypes(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	contentID := "test_content"

	// Create first reaction
	reaction1, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    contentID,
		ReactionType: "👍",
	})
	require.NoError(t, err)

	// Create second reaction with different type (should create new, not update)
	reaction2, err := ts.UpsertReaction(ctx, &store.Reaction{
		CreatorID:    user.ID,
		ContentID:    contentID,
		ReactionType: "❤️",
	})
	require.NoError(t, err)

	// Both reactions should exist
	require.NotEqual(t, reaction1.ID, reaction2.ID)

	reactions, err := ts.ListReactions(ctx, &store.FindReaction{
		ContentID: &contentID,
	})
	require.NoError(t, err)
	require.Len(t, reactions, 2)

	ts.Close()
}

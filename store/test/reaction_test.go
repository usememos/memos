package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestReactionStore(t *testing.T) {
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

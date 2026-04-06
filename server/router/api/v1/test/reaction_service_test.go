package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestDeleteMemoReaction(t *testing.T) {
	ctx := context.Background()

	t.Run("DeleteMemoReaction success by reaction owner", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create memo
		memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction
		reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apiv1.UpsertMemoReactionRequest{
			Name: memo.Name,
			Reaction: &apiv1.Reaction{
				ContentId:    memo.Name,
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)
		require.Equal(t, "users/user", reaction.Creator)

		// Delete reaction - should succeed
		_, err = ts.Service.DeleteMemoReaction(userCtx, &apiv1.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.NoError(t, err)
	})

	t.Run("DeleteMemoReaction success by host user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create regular user
		regularUser, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		regularUserCtx := ts.CreateUserContext(ctx, regularUser.ID)

		// Create host user
		hostUser, err := ts.CreateHostUser(ctx, "admin")
		require.NoError(t, err)
		hostCtx := ts.CreateUserContext(ctx, hostUser.ID)

		// Create memo by regular user
		memo, err := ts.Service.CreateMemo(regularUserCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction by regular user
		reaction, err := ts.Service.UpsertMemoReaction(regularUserCtx, &apiv1.UpsertMemoReactionRequest{
			Name: memo.Name,
			Reaction: &apiv1.Reaction{
				ContentId:    memo.Name,
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// Host user can delete reaction - should succeed
		_, err = ts.Service.DeleteMemoReaction(hostCtx, &apiv1.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.NoError(t, err)
	})

	t.Run("DeleteMemoReaction permission denied for non-owner", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user1
		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user1Ctx := ts.CreateUserContext(ctx, user1.ID)

		// Create user2
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)
		user2Ctx := ts.CreateUserContext(ctx, user2.ID)

		// Create memo by user1
		memo, err := ts.Service.CreateMemo(user1Ctx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction by user1
		reaction, err := ts.Service.UpsertMemoReaction(user1Ctx, &apiv1.UpsertMemoReactionRequest{
			Name: memo.Name,
			Reaction: &apiv1.Reaction{
				ContentId:    memo.Name,
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// User2 tries to delete reaction - should fail with permission denied
		_, err = ts.Service.DeleteMemoReaction(user2Ctx, &apiv1.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("DeleteMemoReaction unauthenticated", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create memo
		memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create reaction
		reaction, err := ts.Service.UpsertMemoReaction(userCtx, &apiv1.UpsertMemoReactionRequest{
			Name: memo.Name,
			Reaction: &apiv1.Reaction{
				ContentId:    memo.Name,
				ReactionType: "👍",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, reaction)

		// Unauthenticated user tries to delete reaction - should fail
		_, err = ts.Service.DeleteMemoReaction(ctx, &apiv1.DeleteMemoReactionRequest{
			Name: reaction.Name,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")
	})

	t.Run("DeleteMemoReaction not found returns permission denied", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Try to delete non-existent reaction - should fail with permission denied
		// (not "not found" to avoid information disclosure)
		// Use new nested resource format: memos/{memo}/reactions/{reaction}
		_, err = ts.Service.DeleteMemoReaction(userCtx, &apiv1.DeleteMemoReactionRequest{
			Name: "memos/nonexistent/reactions/99999",
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
		require.NotContains(t, err.Error(), "not found")
	})
}

func TestListMemoReactionsSkipsMissingCreators(t *testing.T) {
	ctx := context.Background()

	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "reaction-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	reactor, err := ts.CreateRegularUser(ctx, "reaction-orphan")
	require.NoError(t, err)
	reactorCtx := ts.CreateUserContext(ctx, reactor.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "reaction list memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.UpsertMemoReaction(reactorCtx, &apiv1.UpsertMemoReactionRequest{
		Name: memo.Name,
		Reaction: &apiv1.Reaction{
			ContentId:    memo.Name,
			ReactionType: "🔥",
		},
	})
	require.NoError(t, err)

	err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: reactor.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemoReactions(ctx, &apiv1.ListMemoReactionsRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Empty(t, resp.Reactions)
}

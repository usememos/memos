package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestSetMemoRelations(t *testing.T) {
	ctx := context.Background()

	t.Run("SetMemoRelations success by memo owner", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Create memo1
		memo1, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo 1",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo1)

		// Create memo2
		memo2, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "Test memo 2",
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo2)

		// Set memo relations - should succeed
		_, err = ts.Service.SetMemoRelations(userCtx, &apiv1.SetMemoRelationsRequest{
			Name: memo1.Name,
			Relations: []*apiv1.MemoRelation{
				{
					RelatedMemo: &apiv1.MemoRelation_Memo{
						Name: memo2.Name,
					},
					Type: apiv1.MemoRelation_REFERENCE,
				},
			},
		})
		require.NoError(t, err)
	})

	t.Run("SetMemoRelations success by host user", func(t *testing.T) {
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
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Host user can modify relations - should succeed
		_, err = ts.Service.SetMemoRelations(hostCtx, &apiv1.SetMemoRelationsRequest{
			Name:      memo.Name,
			Relations: []*apiv1.MemoRelation{},
		})
		require.NoError(t, err)
	})

	t.Run("SetMemoRelations permission denied for non-owner", func(t *testing.T) {
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
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// User2 tries to modify relations - should fail
		_, err = ts.Service.SetMemoRelations(user2Ctx, &apiv1.SetMemoRelationsRequest{
			Name:      memo.Name,
			Relations: []*apiv1.MemoRelation{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("SetMemoRelations unauthenticated", func(t *testing.T) {
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
				Visibility: apiv1.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Unauthenticated user tries to modify relations - should fail
		_, err = ts.Service.SetMemoRelations(ctx, &apiv1.SetMemoRelationsRequest{
			Name:      memo.Name,
			Relations: []*apiv1.MemoRelation{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")
	})

	t.Run("SetMemoRelations memo not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Try to set relations on non-existent memo - should fail
		_, err = ts.Service.SetMemoRelations(userCtx, &apiv1.SetMemoRelationsRequest{
			Name:      "memos/nonexistent-uid-12345",
			Relations: []*apiv1.MemoRelation{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

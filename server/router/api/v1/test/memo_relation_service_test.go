package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

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

	t.Run("SetMemoRelations host user has no ownership bypass", func(t *testing.T) {
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

		// Application ADMIN is an instance role, not memo authorship.
		_, err = ts.Service.SetMemoRelations(hostCtx, &apiv1.SetMemoRelationsRequest{
			Name:      memo.Name,
			Relations: []*apiv1.MemoRelation{},
		})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
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

func TestUpdateMemoValidatesAllRelationsBeforeMutation(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	user, err := ts.CreateRegularUser(ctx, "atomic-relation-update")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "target"}})
	require.NoError(t, err)
	replacement, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "replacement"}})
	require.NoError(t, err)
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content: "original",
		Relations: []*apiv1.MemoRelation{{
			RelatedMemo: &apiv1.MemoRelation_Memo{Name: target.Name},
			Type:        apiv1.MemoRelation_REFERENCE,
		}},
	}})
	require.NoError(t, err)

	_, err = ts.Service.UpdateMemo(userCtx, &apiv1.UpdateMemoRequest{
		Memo: &apiv1.Memo{
			Name:    source.Name,
			Content: "must roll back",
			Relations: []*apiv1.MemoRelation{
				{RelatedMemo: &apiv1.MemoRelation_Memo{Name: replacement.Name}, Type: apiv1.MemoRelation_REFERENCE},
				{RelatedMemo: &apiv1.MemoRelation_Memo{Name: "invalid-name"}, Type: apiv1.MemoRelation_REFERENCE},
			},
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content", "relations"}},
	})
	require.Equal(t, codes.InvalidArgument, status.Code(err))

	stored, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: source.Name})
	require.NoError(t, err)
	require.Equal(t, "original", stored.Content)
	require.Len(t, stored.Relations, 1)
	require.Equal(t, target.Name, stored.Relations[0].RelatedMemo.Name)
}

func TestSetMemoRelationsRejectsNonReferenceTypes(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, err := ts.CreateRegularUser(ctx, "relation-type-owner")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	source, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "source", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	target, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "target", Visibility: apiv1.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	for _, test := range []struct {
		name         string
		relationType apiv1.MemoRelation_Type
	}{
		{name: "unspecified", relationType: apiv1.MemoRelation_TYPE_UNSPECIFIED},
		{name: "comment", relationType: apiv1.MemoRelation_COMMENT},
		{name: "unknown", relationType: apiv1.MemoRelation_Type(999)},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := ts.Service.SetMemoRelations(userCtx, &apiv1.SetMemoRelationsRequest{
				Name: source.Name,
				Relations: []*apiv1.MemoRelation{{
					RelatedMemo: &apiv1.MemoRelation_Memo{Name: target.Name},
					Type:        test.relationType,
				}},
			})
			require.Equal(t, codes.InvalidArgument, status.Code(err))

			stored, err := ts.Service.GetMemo(userCtx, &apiv1.GetMemoRequest{Name: source.Name})
			require.NoError(t, err)
			require.Empty(t, stored.Relations)
		})
	}
}

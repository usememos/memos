package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestSetMemoAttachments(t *testing.T) {
	ctx := context.Background()

	t.Run("SetMemoAttachments success by memo owner", func(t *testing.T) {
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

		// Create attachment
		attachment, err := ts.Service.CreateAttachment(userCtx, &apiv1.CreateAttachmentRequest{
			Attachment: &apiv1.Attachment{
				Filename: "test.txt",
				Size:     5,
				Type:     "text/plain",
				Content:  []byte("hello"),
			},
		})
		require.NoError(t, err)
		require.NotNil(t, attachment)

		// Set memo attachments - should succeed
		_, err = ts.Service.SetMemoAttachments(userCtx, &apiv1.SetMemoAttachmentsRequest{
			Name: memo.Name,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		})
		require.NoError(t, err)
	})

	t.Run("SetMemoAttachments success by host user", func(t *testing.T) {
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

		// Host user can modify attachments - should succeed
		_, err = ts.Service.SetMemoAttachments(hostCtx, &apiv1.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apiv1.Attachment{},
		})
		require.NoError(t, err)
	})

	t.Run("SetMemoAttachments permission denied for non-owner", func(t *testing.T) {
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

		// User2 tries to modify attachments - should fail
		_, err = ts.Service.SetMemoAttachments(user2Ctx, &apiv1.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apiv1.Attachment{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("SetMemoAttachments unauthenticated", func(t *testing.T) {
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

		// Unauthenticated user tries to modify attachments - should fail
		_, err = ts.Service.SetMemoAttachments(ctx, &apiv1.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apiv1.Attachment{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not authenticated")
	})

	t.Run("SetMemoAttachments memo not found", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		// Create user
		user, err := ts.CreateRegularUser(ctx, "user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		// Try to set attachments on non-existent memo - should fail
		_, err = ts.Service.SetMemoAttachments(userCtx, &apiv1.SetMemoAttachmentsRequest{
			Name:        "memos/nonexistent-uid-12345",
			Attachments: []*apiv1.Attachment{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

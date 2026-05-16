package test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
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

	t.Run("SetMemoAttachments removes incomplete live photo groups", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "live_group_user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		still, err := ts.Service.CreateAttachment(userCtx, &apiv1.CreateAttachmentRequest{
			Attachment: &apiv1.Attachment{
				Filename: "live.heic",
				Type:     "image/heic",
				Content:  []byte("still"),
				MotionMedia: &apiv1.MotionMedia{
					Family:  apiv1.MotionMediaFamily_APPLE_LIVE_PHOTO,
					Role:    apiv1.MotionMediaRole_STILL,
					GroupId: "memo-live-group",
				},
			},
		})
		require.NoError(t, err)
		video, err := ts.Service.CreateAttachment(userCtx, &apiv1.CreateAttachmentRequest{
			Attachment: &apiv1.Attachment{
				Filename: "live.mov",
				Type:     "video/quicktime",
				Content:  []byte("video"),
				MotionMedia: &apiv1.MotionMedia{
					Family:  apiv1.MotionMediaFamily_APPLE_LIVE_PHOTO,
					Role:    apiv1.MotionMediaRole_VIDEO,
					GroupId: "memo-live-group",
				},
			},
		})
		require.NoError(t, err)

		memo, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "memo with live photo",
				Visibility: apiv1.Visibility_PRIVATE,
				Attachments: []*apiv1.Attachment{
					{Name: still.Name},
					{Name: video.Name},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.SetMemoAttachments(userCtx, &apiv1.SetMemoAttachmentsRequest{
			Name: memo.Name,
			Attachments: []*apiv1.Attachment{
				{Name: still.Name},
			},
		})
		require.NoError(t, err)

		response, err := ts.Service.ListMemoAttachments(userCtx, &apiv1.ListMemoAttachmentsRequest{Name: memo.Name})
		require.NoError(t, err)
		require.Len(t, response.Attachments, 0)
	})

	t.Run("SetMemoAttachments denies attaching another user's attachment", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		victim, err := ts.CreateRegularUser(ctx, "attachment_victim")
		require.NoError(t, err)
		attacker, err := ts.CreateRegularUser(ctx, "attachment_attacker")
		require.NoError(t, err)
		victimCtx := ts.CreateUserContext(ctx, victim.ID)
		attackerCtx := ts.CreateUserContext(ctx, attacker.ID)

		victimAttachment, err := ts.Service.CreateAttachment(victimCtx, &apiv1.CreateAttachmentRequest{
			Attachment: &apiv1.Attachment{
				Filename: "secret.txt",
				Size:     6,
				Type:     "text/plain",
				Content:  []byte("secret"),
			},
		})
		require.NoError(t, err)

		victimMemo, err := ts.Service.CreateMemo(victimCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "victim protected memo",
				Visibility: apiv1.Visibility_PROTECTED,
				Attachments: []*apiv1.Attachment{
					{Name: victimAttachment.Name},
				},
			},
		})
		require.NoError(t, err)

		attackerMemo, err := ts.Service.CreateMemo(attackerCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "attacker public memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.SetMemoAttachments(attackerCtx, &apiv1.SetMemoAttachmentsRequest{
			Name: attackerMemo.Name,
			Attachments: []*apiv1.Attachment{
				{Name: victimAttachment.Name},
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot attach another user's attachment")

		victimAttachments, err := ts.Service.ListMemoAttachments(victimCtx, &apiv1.ListMemoAttachmentsRequest{Name: victimMemo.Name})
		require.NoError(t, err)
		require.Len(t, victimAttachments.Attachments, 1)
		require.Equal(t, victimAttachment.Name, victimAttachments.Attachments[0].Name)

		attackerAttachments, err := ts.Service.ListMemoAttachments(attackerCtx, &apiv1.ListMemoAttachmentsRequest{Name: attackerMemo.Name})
		require.NoError(t, err)
		require.Empty(t, attackerAttachments.Attachments)
	})

	t.Run("SetMemoAttachments denies removing another user's attached attachment", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		victim, err := ts.CreateRegularUser(ctx, "remove_victim")
		require.NoError(t, err)
		attacker, err := ts.CreateRegularUser(ctx, "remove_attacker")
		require.NoError(t, err)
		victimCtx := ts.CreateUserContext(ctx, victim.ID)
		attackerCtx := ts.CreateUserContext(ctx, attacker.ID)

		victimAttachment, err := ts.Service.CreateAttachment(victimCtx, &apiv1.CreateAttachmentRequest{
			Attachment: &apiv1.Attachment{
				Filename: "kept.txt",
				Size:     4,
				Type:     "text/plain",
				Content:  []byte("kept"),
			},
		})
		require.NoError(t, err)

		attackerMemo, err := ts.Service.CreateMemo(attackerCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{
				Content:    "contaminated memo",
				Visibility: apiv1.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)

		attachmentUID := strings.TrimPrefix(victimAttachment.Name, "attachments/")
		attachment, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		require.NoError(t, err)
		require.NotNil(t, attachment)

		memoUID := strings.TrimPrefix(attackerMemo.Name, "memos/")
		memo, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		require.NoError(t, err)
		require.NotNil(t, memo)

		err = ts.Store.UpdateAttachment(ctx, &store.UpdateAttachment{
			ID:     attachment.ID,
			MemoID: &memo.ID,
		})
		require.NoError(t, err)

		_, err = ts.Service.SetMemoAttachments(attackerCtx, &apiv1.SetMemoAttachmentsRequest{
			Name:        attackerMemo.Name,
			Attachments: []*apiv1.Attachment{},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot remove another user's attachment")

		attachmentAfter, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
		require.NoError(t, err)
		require.NotNil(t, attachmentAfter)
		require.NotNil(t, attachmentAfter.MemoID)
		require.Equal(t, memo.ID, *attachmentAfter.MemoID)
	})
}

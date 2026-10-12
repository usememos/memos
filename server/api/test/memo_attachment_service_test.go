package test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
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
		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Create attachment
		attachment, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{
				Filename: "test.txt",
				Size:     5,
				Type:     "text/plain",
				Content:  []byte("hello"),
			},
		})
		require.NoError(t, err)
		require.NotNil(t, attachment)

		// Set memo attachments - should succeed
		_, err = ts.Service.SetMemoAttachments(userCtx, &apipb.SetMemoAttachmentsRequest{
			Name: memo.Name,
			Attachments: []*apipb.Attachment{
				{Name: attachment.Name},
			},
		})
		require.NoError(t, err)
	})

	t.Run("SetMemoAttachments host user has no ownership bypass", func(t *testing.T) {
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
		memo, err := ts.Service.CreateMemo(regularUserCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Application ADMIN is the superuser and manages any memo's attachments.
		_, err = ts.Service.SetMemoAttachments(hostCtx, &apipb.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apipb.Attachment{},
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
		memo, err := ts.Service.CreateMemo(user1Ctx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// User2 tries to modify attachments - should fail
		_, err = ts.Service.SetMemoAttachments(user2Ctx, &apipb.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apipb.Attachment{},
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
		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "Test memo",
				Visibility: apipb.Visibility_PRIVATE,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, memo)

		// Unauthenticated user tries to modify attachments - should fail
		_, err = ts.Service.SetMemoAttachments(ctx, &apipb.SetMemoAttachmentsRequest{
			Name:        memo.Name,
			Attachments: []*apipb.Attachment{},
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
		_, err = ts.Service.SetMemoAttachments(userCtx, &apipb.SetMemoAttachmentsRequest{
			Name:        "memos/nonexistent-uid-12345",
			Attachments: []*apipb.Attachment{},
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

		still, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{
				Filename: "live.heic",
				Type:     "image/heic",
				Content:  []byte("still"),
				MotionMedia: &apipb.MotionMedia{
					Family:  apipb.MotionMediaFamily_APPLE_LIVE_PHOTO,
					Role:    apipb.MotionMediaRole_STILL,
					GroupId: "memo-live-group",
				},
			},
		})
		require.NoError(t, err)
		video, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{
				Filename: "live.mov",
				Type:     "video/quicktime",
				Content:  []byte("video"),
				MotionMedia: &apipb.MotionMedia{
					Family:  apipb.MotionMediaFamily_APPLE_LIVE_PHOTO,
					Role:    apipb.MotionMediaRole_VIDEO,
					GroupId: "memo-live-group",
				},
			},
		})
		require.NoError(t, err)

		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "memo with live photo",
				Visibility: apipb.Visibility_PRIVATE,
				Attachments: []*apipb.Attachment{
					{Name: still.Name},
					{Name: video.Name},
				},
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.SetMemoAttachments(userCtx, &apipb.SetMemoAttachmentsRequest{
			Name: memo.Name,
			Attachments: []*apipb.Attachment{
				{Name: still.Name},
			},
		})
		require.NoError(t, err)

		response, err := ts.Service.ListMemoAttachments(userCtx, &apipb.ListMemoAttachmentsRequest{Parent: memo.Name})
		require.NoError(t, err)
		require.Len(t, response.Attachments, 0)
		for _, attachmentName := range []string{still.Name, video.Name} {
			attachmentUID := strings.TrimPrefix(attachmentName, "attachments/")
			stored, getErr := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
			require.NoError(t, getErr)
			require.Nil(t, stored, "removed motion-media attachment row must be deleted")
		}
	})

	t.Run("SetMemoAttachments rejection leaves an incomplete external motion group unchanged", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "partial_motion_group_user")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		still, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{Attachment: &apipb.Attachment{
			Filename: "partial.heic",
			Type:     "image/heic",
			Content:  []byte("still"),
			MotionMedia: &apipb.MotionMedia{
				Family:  apipb.MotionMediaFamily_APPLE_LIVE_PHOTO,
				Role:    apipb.MotionMediaRole_STILL,
				GroupId: "partial-motion-group",
			},
		}})
		require.NoError(t, err)
		video, err := ts.Service.CreateAttachment(userCtx, &apipb.CreateAttachmentRequest{Attachment: &apipb.Attachment{
			Filename: "partial.mov",
			Type:     "video/quicktime",
			Content:  []byte("video"),
			MotionMedia: &apipb.MotionMedia{
				Family:  apipb.MotionMediaFamily_APPLE_LIVE_PHOTO,
				Role:    apipb.MotionMediaRole_VIDEO,
				GroupId: "partial-motion-group",
			},
		}})
		require.NoError(t, err)

		memo, err := ts.Service.CreateMemo(userCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{
			Content:     "memo with one motion-group member",
			Visibility:  apipb.Visibility_PRIVATE,
			Attachments: []*apipb.Attachment{{Name: still.Name}},
		}})
		require.NoError(t, err)
		memoUID := strings.TrimPrefix(memo.Name, "memos/")
		storedMemo, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		require.NoError(t, err)
		require.NotNil(t, storedMemo)
		initialUpdatedTs := int64(1)
		require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: storedMemo.ID, UpdatedTs: &initialUpdatedTs}))

		_, err = ts.Service.SetMemoAttachments(userCtx, &apipb.SetMemoAttachmentsRequest{Name: memo.Name})
		require.Equal(t, codes.FailedPrecondition, status.Code(err))

		stillUID := strings.TrimPrefix(still.Name, "attachments/")
		storedStill, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &stillUID})
		require.NoError(t, err)
		require.NotNil(t, storedStill)
		require.NotNil(t, storedStill.MemoID)
		require.Equal(t, storedMemo.ID, *storedStill.MemoID)
		videoUID := strings.TrimPrefix(video.Name, "attachments/")
		storedVideo, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &videoUID})
		require.NoError(t, err)
		require.NotNil(t, storedVideo)
		require.Nil(t, storedVideo.MemoID)
		storedMemo, err = ts.Store.GetMemo(ctx, &store.FindMemo{ID: &storedMemo.ID})
		require.NoError(t, err)
		require.Equal(t, initialUpdatedTs, storedMemo.UpdatedTs)
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

		victimAttachment, err := ts.Service.CreateAttachment(victimCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{
				Filename: "secret.txt",
				Size:     6,
				Type:     "text/plain",
				Content:  []byte("secret"),
			},
		})
		require.NoError(t, err)

		victimMemo, err := ts.Service.CreateMemo(victimCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "victim protected memo",
				Visibility: apipb.Visibility_PROTECTED,
				Attachments: []*apipb.Attachment{
					{Name: victimAttachment.Name},
				},
			},
		})
		require.NoError(t, err)

		attackerMemo, err := ts.Service.CreateMemo(attackerCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "attacker public memo",
				Visibility: apipb.Visibility_PUBLIC,
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.SetMemoAttachments(attackerCtx, &apipb.SetMemoAttachmentsRequest{
			Name: attackerMemo.Name,
			Attachments: []*apipb.Attachment{
				{Name: victimAttachment.Name},
			},
		})
		require.Error(t, err)
		require.Equal(t, codes.NotFound, status.Code(err))

		victimAttachments, err := ts.Service.ListMemoAttachments(victimCtx, &apipb.ListMemoAttachmentsRequest{Parent: victimMemo.Name})
		require.NoError(t, err)
		require.Len(t, victimAttachments.Attachments, 1)
		require.Equal(t, victimAttachment.Name, victimAttachments.Attachments[0].Name)

		attackerAttachments, err := ts.Service.ListMemoAttachments(attackerCtx, &apipb.ListMemoAttachmentsRequest{Parent: attackerMemo.Name})
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

		victimAttachment, err := ts.Service.CreateAttachment(victimCtx, &apipb.CreateAttachmentRequest{
			Attachment: &apipb.Attachment{
				Filename: "kept.txt",
				Size:     4,
				Type:     "text/plain",
				Content:  []byte("kept"),
			},
		})
		require.NoError(t, err)

		attackerMemo, err := ts.Service.CreateMemo(attackerCtx, &apipb.CreateMemoRequest{
			Memo: &apipb.Memo{
				Content:    "contaminated memo",
				Visibility: apipb.Visibility_PUBLIC,
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

		_, err = ts.Service.SetMemoAttachments(attackerCtx, &apipb.SetMemoAttachmentsRequest{
			Name:        attackerMemo.Name,
			Attachments: []*apipb.Attachment{},
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

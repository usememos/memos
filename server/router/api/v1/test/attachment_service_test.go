package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestCreateAttachment(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()

	user, err := ts.CreateRegularUser(ctx, "test_user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	// Test case 1: Create attachment with empty type but known extension
	t.Run("EmptyType_KnownExtension", func(t *testing.T) {
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "test.png",
				Content:  []byte("fake png content"),
			},
		})
		require.NoError(t, err)
		require.Equal(t, "image/png", attachment.Type)
	})

	// Test case 2: Create attachment with empty type and unknown extension, but detectable content
	t.Run("EmptyType_UnknownExtension_ContentSniffing", func(t *testing.T) {
		// PNG magic header: 89 50 4E 47 0D 0A 1A 0A
		pngContent := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "test.unknown",
				Content:  pngContent,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "image/png", attachment.Type)
	})

	// Test case 3: Empty type, unknown extension, random content -> fallback to application/octet-stream
	t.Run("EmptyType_Fallback", func(t *testing.T) {
		randomContent := []byte{0x00, 0x01, 0x02, 0x03}
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "test.data",
				Content:  randomContent,
			},
		})
		require.NoError(t, err)
		require.Equal(t, "application/octet-stream", attachment.Type)
	})

	t.Run("Type_WithParameters_NormalizedBeforeValidation", func(t *testing.T) {
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "voice-note.webm",
				Type:     "audio/webm;codecs=opus",
				Content:  []byte("fake webm content"),
			},
		})
		require.NoError(t, err)
		require.Equal(t, "audio/webm", attachment.Type)
	})

	t.Run("Type_InvalidFormat_Rejected", func(t *testing.T) {
		_, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "broken.webm",
				Type:     `audio/webm;codecs="unterminated`,
				Content:  []byte("fake webm content"),
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid MIME type format")
	})

	t.Run("LocalStorage_PathCollisionUsesUniqueReference", func(t *testing.T) {
		_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key: storepb.InstanceSettingKey_STORAGE,
			Value: &storepb.InstanceSetting_StorageSetting{
				StorageSetting: &storepb.InstanceStorageSetting{
					StorageType:      storepb.InstanceStorageSetting_LOCAL,
					FilepathTemplate: "assets/{filename}",
				},
			},
		})
		require.NoError(t, err)

		first, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "screenshot.png",
				Type:     "image/png",
				Content:  []byte("first-image"),
			},
		})
		require.NoError(t, err)

		second, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "screenshot.png",
				Type:     "image/png",
				Content:  []byte("second-image"),
			},
		})
		require.NoError(t, err)

		firstUID, err := apiv1.ExtractAttachmentUIDFromName(first.Name)
		require.NoError(t, err)
		secondUID, err := apiv1.ExtractAttachmentUIDFromName(second.Name)
		require.NoError(t, err)

		firstStoreAttachment, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &firstUID})
		require.NoError(t, err)
		secondStoreAttachment, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &secondUID})
		require.NoError(t, err)
		require.NotNil(t, firstStoreAttachment)
		require.NotNil(t, secondStoreAttachment)

		require.NotEqual(t, firstStoreAttachment.Reference, secondStoreAttachment.Reference)

		firstBlob, err := ts.Service.GetAttachmentBlob(firstStoreAttachment)
		require.NoError(t, err)
		secondBlob, err := ts.Service.GetAttachmentBlob(secondStoreAttachment)
		require.NoError(t, err)
		require.Equal(t, []byte("first-image"), firstBlob)
		require.Equal(t, []byte("second-image"), secondBlob)
	})
}

func TestCreateAttachmentMemoPermission(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can create attachment directly linked to memo", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		owner, err := ts.CreateRegularUser(ctx, "attachment-owner")
		require.NoError(t, err)
		ownerCtx := ts.CreateUserContext(ctx, owner.ID)

		memo, err := ts.Service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
			Memo: &v1pb.Memo{
				Content: "memo with direct attachment",
			},
		})
		require.NoError(t, err)

		attachment, err := ts.Service.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "owner.txt",
				Type:     "text/plain",
				Content:  []byte("owner"),
				Memo:     &memo.Name,
			},
		})
		require.NoError(t, err)
		attachmentUID, err := apiv1.ExtractAttachmentUIDFromName(attachment.Name)
		require.NoError(t, err)
		stored, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		require.NoError(t, err)
		require.NotNil(t, stored.MemoID)
		require.Equal(t, memoIDFromName(ctx, t, ts, memo.Name), *stored.MemoID)
	})

	t.Run("admin can create attachment directly linked to memo", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		owner, err := ts.CreateRegularUser(ctx, "attachment-admin-owner")
		require.NoError(t, err)
		ownerCtx := ts.CreateUserContext(ctx, owner.ID)
		admin, err := ts.CreateHostUser(ctx, "attachment-admin")
		require.NoError(t, err)
		adminCtx := ts.CreateUserContext(ctx, admin.ID)

		memo, err := ts.Service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
			Memo: &v1pb.Memo{
				Content: "memo with admin attachment",
			},
		})
		require.NoError(t, err)

		attachment, err := ts.Service.CreateAttachment(adminCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "admin.txt",
				Type:     "text/plain",
				Content:  []byte("admin"),
				Memo:     &memo.Name,
			},
		})
		require.NoError(t, err)
		attachmentUID, err := apiv1.ExtractAttachmentUIDFromName(attachment.Name)
		require.NoError(t, err)
		stored, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		require.NoError(t, err)
		require.NotNil(t, stored.MemoID)
		require.Equal(t, memoIDFromName(ctx, t, ts, memo.Name), *stored.MemoID)
	})

	t.Run("non-owner cannot create attachment directly linked to memo", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		owner, err := ts.CreateRegularUser(ctx, "attachment-owner-denied")
		require.NoError(t, err)
		ownerCtx := ts.CreateUserContext(ctx, owner.ID)
		other, err := ts.CreateRegularUser(ctx, "attachment-other-denied")
		require.NoError(t, err)
		otherCtx := ts.CreateUserContext(ctx, other.ID)

		memo, err := ts.Service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{
			Memo: &v1pb.Memo{
				Content: "memo with blocked attachment",
			},
		})
		require.NoError(t, err)

		_, err = ts.Service.CreateAttachment(otherCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "blocked.txt",
				Type:     "text/plain",
				Content:  []byte("blocked"),
				Memo:     &memo.Name,
			},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		attachments, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{
			CreatorID: &other.ID,
		})
		require.NoError(t, err)
		require.Empty(t, attachments)
	})
}

func memoIDFromName(ctx context.Context, t *testing.T, ts *TestService, name string) int32 {
	t.Helper()
	memoUID, err := apiv1.ExtractMemoUIDFromName(name)
	require.NoError(t, err)
	memo, err := ts.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	require.NoError(t, err)
	require.NotNil(t, memo)
	return memo.ID
}

func TestCreateAttachmentMotionMedia(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()

	user, err := ts.CreateRegularUser(ctx, "motion_user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	t.Run("Apple live photo metadata roundtrip", func(t *testing.T) {
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "live.heic",
				Type:     "image/heic",
				Content:  []byte("fake-heic-still"),
				MotionMedia: &v1pb.MotionMedia{
					Family:  v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO,
					Role:    v1pb.MotionMediaRole_STILL,
					GroupId: "apple-group-1",
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, attachment.MotionMedia)
		require.Equal(t, v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO, attachment.MotionMedia.Family)
		require.Equal(t, v1pb.MotionMediaRole_STILL, attachment.MotionMedia.Role)
		require.Equal(t, "apple-group-1", attachment.MotionMedia.GroupId)
	})

	t.Run("Android motion photo detection", func(t *testing.T) {
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "motion.jpg",
				Type:     "image/jpeg",
				Content:  testutil.BuildMotionPhotoJPEG(),
			},
		})
		require.NoError(t, err)
		require.NotNil(t, attachment.MotionMedia)
		require.Equal(t, v1pb.MotionMediaFamily_ANDROID_MOTION_PHOTO, attachment.MotionMedia.Family)
		require.Equal(t, v1pb.MotionMediaRole_CONTAINER, attachment.MotionMedia.Role)
		require.True(t, attachment.MotionMedia.HasEmbeddedVideo)
	})
}

func TestBatchDeleteAttachments(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()

	user, err := ts.CreateRegularUser(ctx, "delete_user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	first, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{Filename: "one.txt", Type: "text/plain", Content: []byte("one")},
	})
	require.NoError(t, err)
	second, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{Filename: "two.txt", Type: "text/plain", Content: []byte("two")},
	})
	require.NoError(t, err)

	_, err = ts.Service.BatchDeleteAttachments(userCtx, &v1pb.BatchDeleteAttachmentsRequest{
		Names: []string{first.Name, second.Name},
	})
	require.NoError(t, err)

	firstUID, err := apiv1.ExtractAttachmentUIDFromName(first.Name)
	require.NoError(t, err)
	secondUID, err := apiv1.ExtractAttachmentUIDFromName(second.Name)
	require.NoError(t, err)
	storedFirst, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &firstUID})
	require.NoError(t, err)
	storedSecond, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &secondUID})
	require.NoError(t, err)
	require.Nil(t, storedFirst)
	require.Nil(t, storedSecond)

	t.Run("deduplicates duplicate names", func(t *testing.T) {
		third, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{Filename: "three.txt", Type: "text/plain", Content: []byte("three")},
		})
		require.NoError(t, err)

		_, err = ts.Service.BatchDeleteAttachments(userCtx, &v1pb.BatchDeleteAttachmentsRequest{
			Names: []string{third.Name, third.Name},
		})
		require.NoError(t, err)

		thirdUID, err := apiv1.ExtractAttachmentUIDFromName(third.Name)
		require.NoError(t, err)
		storedThird, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &thirdUID})
		require.NoError(t, err)
		require.Nil(t, storedThird)
	})

	t.Run("rejects unauthorized deletes", func(t *testing.T) {
		ownerAttachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{Filename: "private.txt", Type: "text/plain", Content: []byte("private")},
		})
		require.NoError(t, err)

		otherUser, err := ts.CreateRegularUser(ctx, "other_delete_user")
		require.NoError(t, err)
		otherCtx := ts.CreateUserContext(ctx, otherUser.ID)

		_, err = ts.Service.BatchDeleteAttachments(otherCtx, &v1pb.BatchDeleteAttachmentsRequest{
			Names: []string{ownerAttachment.Name},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}

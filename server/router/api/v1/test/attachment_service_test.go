package test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

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

func TestAttachmentMetadataFollowsMemoVisibility(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	owner, err := ts.CreateRegularUser(ctx, "metadata-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	attachment, err := ts.Service.CreateAttachment(ownerCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "metadata.png",
		Type:     "image/png",
		Content:  []byte("metadata image"),
	}})
	require.NoError(t, err)
	memo, err := ts.Service.CreateMemo(ownerCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:     "public metadata",
		Visibility:  v1pb.Visibility_PUBLIC,
		Attachments: []*v1pb.Attachment{{Name: attachment.Name}},
	}})
	require.NoError(t, err)

	_, err = ts.Service.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: attachment.Name})
	require.NoError(t, err)
	listed, err := ts.Service.ListMemoAttachments(ctx, &v1pb.ListMemoAttachmentsRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Len(t, listed.Attachments, 1)

	protected := store.Protected
	memoID := memoIDFromName(ctx, t, ts, memo.Name)
	require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memoID, Visibility: &protected}))
	_, err = ts.Service.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: attachment.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.ListMemoAttachments(ctx, &v1pb.ListMemoAttachmentsRequest{Name: memo.Name})
	require.Equal(t, codes.Unauthenticated, status.Code(err))

	archived := store.Archived
	require.NoError(t, ts.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memoID, RowStatus: &archived}))
	_, err = ts.Service.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: attachment.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
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

	t.Run("admin cannot create an admin-owned attachment linked to another user's memo", func(t *testing.T) {
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

		_, err = ts.Service.CreateAttachment(adminCtx, &v1pb.CreateAttachmentRequest{
			Attachment: &v1pb.Attachment{
				Filename: "admin.txt",
				Type:     "text/plain",
				Content:  []byte("admin"),
				Memo:     &memo.Name,
			},
		})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
		attachments, err := ts.Store.ListAttachments(ctx, &store.FindAttachment{CreatorID: &admin.ID})
		require.NoError(t, err)
		require.Empty(t, attachments)
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

func TestCreateAttachmentMediaMetadata(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()

	user, err := ts.CreateRegularUser(ctx, "media_metadata_user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	photoMetadata := &v1pb.MediaMetadata{
		Width:  proto.Int32(20),
		Height: proto.Int32(10),
		Details: &v1pb.MediaMetadata_Photo{Photo: &v1pb.PhotoMetadata{
			CaptureTime: &v1pb.MediaCaptureTime{
				LocalDateTime: "2026-08-10T14:32:18.123",
				UtcOffset:     proto.String("+08:00"),
			},
			Location: &v1pb.MediaLocation{
				Latitude:       proto.Float64(1.3521),
				Longitude:      proto.Float64(103.8198),
				AltitudeMeters: proto.Float64(18.4),
			},
			SourceExifOrientation: proto.Int32(6),
			CameraMake:            "Apple",
			CameraModel:           "iPhone",
			LensModel:             "Main Camera",
			FNumber:               proto.Float64(1.78),
			ExposureTimeSeconds:   proto.Float64(1.0 / 120.0),
			Iso:                   proto.Int32(64),
			FocalLengthMm:         proto.Float64(6.86),
		}},
	}

	photo, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename:      "photo.jpg",
			Type:          "image/jpeg",
			Content:       testutil.BuildJPEG(20, 10),
			MediaMetadata: photoMetadata,
		},
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(photoMetadata, photo.MediaMetadata))

	photoUID, err := apiv1.ExtractAttachmentUIDFromName(photo.Name)
	require.NoError(t, err)
	storedPhoto, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &photoUID})
	require.NoError(t, err)
	require.NotNil(t, storedPhoto.Payload.GetMediaMetadata())
	require.Equal(t, "Apple", storedPhoto.Payload.GetMediaMetadata().GetPhoto().GetCameraMake())
	require.Equal(t, int32(6), storedPhoto.Payload.GetMediaMetadata().GetPhoto().GetSourceExifOrientation())

	gotPhoto, err := ts.Service.GetAttachment(userCtx, &v1pb.GetAttachmentRequest{Name: photo.Name})
	require.NoError(t, err)
	require.True(t, proto.Equal(photoMetadata, gotPhoto.MediaMetadata))

	listed, err := ts.Service.ListAttachments(userCtx, &v1pb.ListAttachmentsRequest{PageSize: 100})
	require.NoError(t, err)
	var listedPhoto *v1pb.Attachment
	for _, attachment := range listed.Attachments {
		if attachment.Name == photo.Name {
			listedPhoto = attachment
			break
		}
	}
	require.NotNil(t, listedPhoto)
	require.True(t, proto.Equal(photoMetadata, listedPhoto.MediaMetadata))

	memo, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:     "memo with metadata",
		Visibility:  v1pb.Visibility_PRIVATE,
		Attachments: []*v1pb.Attachment{{Name: photo.Name}},
	}})
	require.NoError(t, err)
	require.Len(t, memo.Attachments, 1)
	require.True(t, proto.Equal(photoMetadata, memo.Attachments[0].MediaMetadata))

	video, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{
			Filename: "clip.mp4",
			Type:     "video/mp4",
			Content:  []byte("fake-video"),
			MediaMetadata: &v1pb.MediaMetadata{
				Width:  proto.Int32(1920),
				Height: proto.Int32(1080),
				Details: &v1pb.MediaMetadata_Video{Video: &v1pb.VideoMetadata{
					DurationSeconds: proto.Float64(12.5),
				}},
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 12.5, video.MediaMetadata.GetVideo().GetDurationSeconds())

	withoutMetadata, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
		Attachment: &v1pb.Attachment{Filename: "plain.png", Type: "image/png", Content: []byte("fake-png")},
	})
	require.NoError(t, err)
	require.Nil(t, withoutMetadata.MediaMetadata)
	plainUID, err := apiv1.ExtractAttachmentUIDFromName(withoutMetadata.Name)
	require.NoError(t, err)
	storedPlain, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &plainUID})
	require.NoError(t, err)
	require.Nil(t, storedPlain.Payload.GetMediaMetadata())
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

func TestBatchDeleteAttachmentsStorageFailureIsRetriable(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "delete_retry_user")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	attachments := make([]*v1pb.Attachment, 0, 2)
	for _, filename := range []string{"retry-one.png", "retry-two.png"} {
		attachment, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
			Filename: filename,
			Type:     "image/png",
			Content:  []byte(filename),
		}})
		require.NoError(t, err)
		attachments = append(attachments, attachment)
	}
	memo, err := ts.Service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{Memo: &v1pb.Memo{
		Content:     "batch deletion retry",
		Attachments: []*v1pb.Attachment{{Name: attachments[0].Name}, {Name: attachments[1].Name}},
	}})
	require.NoError(t, err)

	localPaths := make([]string, 0, len(attachments))
	for index, attachment := range attachments {
		uid, err := apiv1.ExtractAttachmentUIDFromName(attachment.Name)
		require.NoError(t, err)
		stored, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
		require.NoError(t, err)
		reference := filepath.Join("batch-delete-retry", attachment.Filename)
		path := filepath.Join(ts.Profile.Data, reference)
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o700))
		require.NoError(t, os.WriteFile(path, []byte(attachment.Filename), 0o600))
		_, err = ts.Store.GetDriver().GetDB().ExecContext(ctx,
			"UPDATE attachment SET storage_type = ?, reference = ? WHERE id = ?",
			"LOCAL", reference, stored.ID,
		)
		require.NoError(t, err, "attachment %d", index)
		localPaths = append(localPaths, path)
	}

	names := []string{attachments[0].Name, attachments[1].Name}
	_, err = ts.Service.BatchDeleteAttachments(store.WithDeleteAttachmentStorageFailpoint(userCtx), &v1pb.BatchDeleteAttachmentsRequest{Names: names})
	require.Equal(t, codes.Internal, status.Code(err))
	for _, attachment := range attachments {
		uid, err := apiv1.ExtractAttachmentUIDFromName(attachment.Name)
		require.NoError(t, err)
		stored, err := ts.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
		require.NoError(t, err)
		require.NotNil(t, stored)
		require.Nil(t, stored.MemoID)
	}
	listed, err := ts.Service.ListMemoAttachments(userCtx, &v1pb.ListMemoAttachmentsRequest{Name: memo.Name})
	require.NoError(t, err)
	require.Empty(t, listed.Attachments)

	_, err = ts.Service.BatchDeleteAttachments(userCtx, &v1pb.BatchDeleteAttachmentsRequest{Names: names})
	require.NoError(t, err)
	for _, path := range localPaths {
		_, err := os.Stat(path)
		require.ErrorIs(t, err, os.ErrNotExist)
	}
}

func TestDeleteMotionMediaGroupRequiresWholeGroup(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "delete-motion-group")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	still, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "live.jpg",
		Type:     "image/jpeg",
		Content:  []byte("still"),
		MotionMedia: &v1pb.MotionMedia{
			Family:  v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO,
			Role:    v1pb.MotionMediaRole_STILL,
			GroupId: "delete-live-group",
		},
	}})
	require.NoError(t, err)
	video, err := ts.Service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{Attachment: &v1pb.Attachment{
		Filename: "live.mov",
		Type:     "video/quicktime",
		Content:  []byte("video"),
		MotionMedia: &v1pb.MotionMedia{
			Family:  v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO,
			Role:    v1pb.MotionMediaRole_VIDEO,
			GroupId: "delete-live-group",
		},
	}})
	require.NoError(t, err)

	_, err = ts.Service.DeleteAttachment(userCtx, &v1pb.DeleteAttachmentRequest{Name: still.Name})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
	_, err = ts.Service.BatchDeleteAttachments(userCtx, &v1pb.BatchDeleteAttachmentsRequest{Names: []string{still.Name, video.Name}})
	require.NoError(t, err)
}

func TestDeleteMotionMediaGroupChecksBeyondDefaultAttachmentPage(t *testing.T) {
	ts := NewTestService(t)
	defer ts.Cleanup()
	ctx := context.Background()
	user, err := ts.CreateRegularUser(ctx, "delete-motion-group-many")
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	still, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  "old-live.jpg",
		Type:      "image/jpeg",
		Payload: &storepb.AttachmentPayload{MotionMedia: &storepb.MotionMedia{
			Family:  storepb.MotionMediaFamily_APPLE_LIVE_PHOTO,
			Role:    storepb.MotionMediaRole_STILL,
			GroupId: "delete-old-live-group",
		}},
	})
	require.NoError(t, err)
	for i := 0; i < 100; i++ {
		attachment, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
			UID: shortuuid.New(), CreatorID: user.ID, Filename: "filler.txt", Type: "text/plain",
		})
		require.NoError(t, err)
		updatedTs := still.UpdatedTs + int64(i) + 1
		require.NoError(t, ts.Store.UpdateAttachment(ctx, &store.UpdateAttachment{ID: attachment.ID, UpdatedTs: &updatedTs}))
	}
	video, err := ts.Store.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  "new-live.mov",
		Type:      "video/quicktime",
		Payload: &storepb.AttachmentPayload{MotionMedia: &storepb.MotionMedia{
			Family:  storepb.MotionMediaFamily_APPLE_LIVE_PHOTO,
			Role:    storepb.MotionMediaRole_VIDEO,
			GroupId: "delete-old-live-group",
		}},
	})
	require.NoError(t, err)
	updatedTs := still.UpdatedTs + 1000
	require.NoError(t, ts.Store.UpdateAttachment(ctx, &store.UpdateAttachment{ID: video.ID, UpdatedTs: &updatedTs}))

	_, err = ts.Service.DeleteAttachment(userCtx, &v1pb.DeleteAttachmentRequest{Name: "attachments/" + video.UID})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
}

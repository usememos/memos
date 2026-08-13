package test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestAttachmentNeedsInstanceStorageSetting(t *testing.T) {
	tests := []struct {
		name       string
		attachment *store.Attachment
		want       bool
	}{
		{
			name: "nil attachment",
		},
		{
			name: "local attachment",
			attachment: &store.Attachment{
				StorageType: storepb.AttachmentStorageType_LOCAL,
			},
		},
		{
			name: "s3 attachment without payload",
			attachment: &store.Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
			},
		},
		{
			name: "s3 attachment with embedded config",
			attachment: &store.Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
				Payload: &storepb.AttachmentPayload{
					Payload: &storepb.AttachmentPayload_S3Object_{
						S3Object: &storepb.AttachmentPayload_S3Object{
							S3Config: &storepb.StorageS3Config{},
						},
					},
				},
			},
			want: true,
		},
		{
			name: "s3 attachment without embedded config",
			attachment: &store.Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
				Payload: &storepb.AttachmentPayload{
					Payload: &storepb.AttachmentPayload_S3Object_{
						S3Object: &storepb.AttachmentPayload_S3Object{},
					},
				},
			},
			want: true,
		},
		{
			name: "s3 attachment with storage ID",
			attachment: &store.Attachment{
				StorageType: storepb.AttachmentStorageType_S3,
				Payload: &storepb.AttachmentPayload{
					Payload: &storepb.AttachmentPayload_S3Object_{
						S3Object: &storepb.AttachmentPayload_S3Object{StorageId: "s3-primary"},
					},
				},
			},
			want: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := store.AttachmentNeedsInstanceStorageSetting(test.attachment); got != test.want {
				t.Fatalf("AttachmentNeedsInstanceStorageSetting() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestAttachmentStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.epub",
		Blob:      []byte("test"),
		Type:      "application/epub+zip",
		Size:      637607,
		Payload: &storepb.AttachmentPayload{
			Payload: &storepb.AttachmentPayload_S3Object_{
				S3Object: &storepb.AttachmentPayload_S3Object{Key: "attachments/test.jpg", StorageId: "s3-primary"},
			},
			MotionMedia: &storepb.MotionMedia{
				Family:  storepb.MotionMediaFamily_APPLE_LIVE_PHOTO,
				Role:    storepb.MotionMediaRole_STILL,
				GroupId: "live-photo-pair",
			},
			MediaMetadata: &storepb.MediaMetadata{
				Width:  proto.Int32(1200),
				Height: proto.Int32(800),
				Details: &storepb.MediaMetadata_Photo{Photo: &storepb.PhotoMetadata{
					CameraMake:            "Test Camera",
					SourceExifOrientation: proto.Int32(6),
				}},
			},
		},
	})
	require.NoError(t, err)

	correctFilename := "test.epub"
	incorrectFilename := "test.png"
	attachment, err := ts.GetAttachment(ctx, &store.FindAttachment{
		Filename: &correctFilename,
	})
	require.NoError(t, err)
	require.Equal(t, correctFilename, attachment.Filename)
	require.Equal(t, int32(1), attachment.ID)
	require.Equal(t, int32(1200), attachment.Payload.GetMediaMetadata().GetWidth())
	require.Equal(t, "Test Camera", attachment.Payload.GetMediaMetadata().GetPhoto().GetCameraMake())
	require.Equal(t, int32(6), attachment.Payload.GetMediaMetadata().GetPhoto().GetSourceExifOrientation())
	require.Equal(t, "attachments/test.jpg", attachment.Payload.GetS3Object().GetKey())
	require.Equal(t, "s3-primary", attachment.Payload.GetS3Object().GetStorageId())
	require.Equal(t, "live-photo-pair", attachment.Payload.GetMotionMedia().GetGroupId())

	notFoundAttachment, err := ts.GetAttachment(ctx, &store.FindAttachment{
		Filename: &incorrectFilename,
	})
	require.NoError(t, err)
	require.Nil(t, notFoundAttachment)

	var correctCreatorID int32 = 101
	var incorrectCreatorID int32 = 102
	_, err = ts.GetAttachment(ctx, &store.FindAttachment{
		CreatorID: &correctCreatorID,
	})
	require.NoError(t, err)

	notFoundAttachment, err = ts.GetAttachment(ctx, &store.FindAttachment{
		CreatorID: &incorrectCreatorID,
	})
	require.NoError(t, err)
	require.Nil(t, notFoundAttachment)

	err = ts.DeleteAttachment(ctx, &store.DeleteAttachment{
		ID: 1,
	})
	require.NoError(t, err)
	err = ts.DeleteAttachment(ctx, &store.DeleteAttachment{
		ID: 2,
	})
	require.ErrorContains(t, err, "attachment not found")
	ts.Close()
}

func TestMemoMutationRollsBackOnBindingConflict(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  user.ID,
		Content:    "original",
		Visibility: store.Private,
	})
	require.NoError(t, err)
	otherMemo, err := ts.CreateMemo(ctx, &store.Memo{
		UID:        shortuuid.New(),
		CreatorID:  user.ID,
		Content:    "other",
		Visibility: store.Private,
	})
	require.NoError(t, err)
	available, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  "available.png",
		Type:      "image/png",
	})
	require.NoError(t, err)
	conflicting, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  "conflicting.png",
		Type:      "image/png",
		MemoID:    &otherMemo.ID,
	})
	require.NoError(t, err)

	updatedContent := "updated"
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:              memo.ID,
		MemoCreatorID:       user.ID,
		ExpectedMemoContent: memo.Content,
		MemoUpdate:          &store.UpdateMemo{ID: memo.ID, Content: &updatedContent},
		Bindings: []*store.MemoAttachmentBinding{
			{ID: available.ID, UID: available.UID, UpdatedTs: time.Now().Unix()},
			{ID: conflicting.ID, UID: conflicting.UID, UpdatedTs: time.Now().Unix() + 1},
		},
	})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)

	storedMemo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, "original", storedMemo.Content)
	storedAvailable, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &available.ID})
	require.NoError(t, err)
	require.Nil(t, storedAvailable.MemoID)
	storedConflicting, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &conflicting.ID})
	require.NoError(t, err)
	require.NotNil(t, storedConflicting.MemoID)
	require.Equal(t, otherMemo.ID, *storedConflicting.MemoID)
}

func TestMemoMutationUpdatesMemoAndBindingsTogether(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "old", Visibility: store.Private})
	require.NoError(t, err)
	removed, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: shortuuid.New(), CreatorID: user.ID, Filename: "removed.png", Type: "image/png", MemoID: &memo.ID,
	})
	require.NoError(t, err)
	added, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: shortuuid.New(), CreatorID: user.ID, Filename: "added.png", Type: "image/png",
	})
	require.NoError(t, err)

	updatedContent := "new"
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:              memo.ID,
		MemoCreatorID:       user.ID,
		ExpectedMemoContent: memo.Content,
		MemoUpdate:          &store.UpdateMemo{ID: memo.ID, Content: &updatedContent},
		Bindings: []*store.MemoAttachmentBinding{
			{ID: added.ID, UID: added.UID, UpdatedTs: time.Now().Unix()},
		},
		RemovedAttachmentIDs:  []int32{removed.ID},
		RequiredAttachmentIDs: []int32{added.ID},
	})
	require.NoError(t, err)

	storedMemo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, "new", storedMemo.Content)
	storedAdded, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &added.ID})
	require.NoError(t, err)
	require.NotNil(t, storedAdded.MemoID)
	require.Equal(t, memo.ID, *storedAdded.MemoID)
	storedRemoved, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &removed.ID})
	require.NoError(t, err)
	require.Nil(t, storedRemoved.MemoID)
}

func TestMemoMutationRollsBackWhenRequiredAttachmentIsMissing(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	memo, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "old", Visibility: store.Private})
	require.NoError(t, err)
	removed, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: shortuuid.New(), CreatorID: user.ID, Filename: "kept.png", Type: "image/png", MemoID: &memo.ID,
	})
	require.NoError(t, err)
	added, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID: shortuuid.New(), CreatorID: user.ID, Filename: "rolled-back.png", Type: "image/png",
	})
	require.NoError(t, err)

	updatedContent := "new"
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:              memo.ID,
		MemoCreatorID:       user.ID,
		ExpectedMemoContent: memo.Content,
		MemoUpdate:          &store.UpdateMemo{ID: memo.ID, Content: &updatedContent},
		Bindings: []*store.MemoAttachmentBinding{
			{ID: added.ID, UID: added.UID, UpdatedTs: time.Now().Unix()},
		},
		RemovedAttachmentIDs:  []int32{removed.ID},
		RequiredAttachmentIDs: []int32{added.ID + removed.ID + 1000},
	})
	require.ErrorIs(t, err, store.ErrMemoMutationConflict)

	storedMemo, err := ts.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Equal(t, "old", storedMemo.Content)
	storedAdded, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &added.ID})
	require.NoError(t, err)
	require.Nil(t, storedAdded.MemoID)
	storedRemoved, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &removed.ID})
	require.NoError(t, err)
	require.NotNil(t, storedRemoved.MemoID)
	require.Equal(t, memo.ID, *storedRemoved.MemoID)
}

func TestMemoMutationRollsBackMemoAndRelationsTogether(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	source, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "original", Visibility: store.Private})
	require.NoError(t, err)
	originalTarget, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "original target", Visibility: store.Private})
	require.NoError(t, err)
	replacementTarget, err := ts.CreateMemo(ctx, &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Content: "replacement target", Visibility: store.Private})
	require.NoError(t, err)
	_, err = ts.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID: source.ID, RelatedMemoID: originalTarget.ID, Type: store.MemoRelationReference,
	})
	require.NoError(t, err)

	updatedContent := "must roll back"
	err = ts.ApplyMemoMutation(ctx, &store.MemoMutation{
		MemoID:                    source.ID,
		MemoCreatorID:             user.ID,
		ExpectedMemoContent:       source.Content,
		MemoUpdate:                &store.UpdateMemo{ID: source.ID, Content: &updatedContent},
		ReplaceReferenceRelations: true,
		ReferenceRelations: []*store.MemoRelation{
			{MemoID: source.ID, RelatedMemoID: replacementTarget.ID, Type: store.MemoRelationReference},
			{MemoID: source.ID, RelatedMemoID: originalTarget.ID, Type: store.MemoRelationComment},
		},
	})
	require.Error(t, err)

	stored, err := ts.GetMemo(ctx, &store.FindMemo{ID: &source.ID})
	require.NoError(t, err)
	require.Equal(t, "original", stored.Content)
	referenceType := store.MemoRelationReference
	relations, err := ts.ListMemoRelations(ctx, &store.FindMemoRelation{MemoID: &source.ID, Type: &referenceType})
	require.NoError(t, err)
	require.Len(t, relations, 1)
	require.Equal(t, originalTarget.ID, relations[0].RelatedMemoID)
}

func TestAttachmentStoreWithFilter(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.png",
		Blob:      []byte("test"),
		Type:      "image/png",
		Size:      1000,
	})
	require.NoError(t, err)

	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.jpg",
		Blob:      []byte("test"),
		Type:      "image/jpeg",
		Size:      2000,
	})
	require.NoError(t, err)

	_, err = ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "test.pdf",
		Blob:      []byte("test"),
		Type:      "application/pdf",
		Size:      3000,
	})
	require.NoError(t, err)

	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`mime_type == "image/png"`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	require.Equal(t, "image/png", attachments[0].Type)

	attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`mime_type in ["image/png", "image/jpeg"]`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 2)

	attachments, err = ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Filters:   []string{`filename.contains("test")`},
	})
	require.NoError(t, err)
	require.Len(t, attachments, 3)

	ts.Close()
}

func TestAttachmentUpdate(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 101,
		Filename:  "original.png",
		Blob:      []byte("test"),
		Type:      "image/png",
		Size:      1000,
	})
	require.NoError(t, err)

	// Update filename
	newFilename := "updated.png"
	err = ts.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID:       attachment.ID,
		Filename: &newFilename,
	})
	require.NoError(t, err)

	// Verify update
	found, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
	require.NoError(t, err)
	require.Equal(t, newFilename, found.Filename)

	ts.Close()
}

func TestAttachmentGetByUID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	uid := shortuuid.New()
	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       uid,
		CreatorID: 101,
		Filename:  "test.png",
		Blob:      []byte("test"),
		Type:      "image/png",
		Size:      1000,
	})
	require.NoError(t, err)

	// Get by UID
	found, err := ts.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, uid, found.UID)

	// Get non-existent UID
	nonExistentUID := "non-existent-uid"
	notFound, err := ts.GetAttachment(ctx, &store.FindAttachment{UID: &nonExistentUID})
	require.NoError(t, err)
	require.Nil(t, notFound)

	ts.Close()
}

func TestAttachmentListWithPagination(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create 5 attachments
	for i := 0; i < 5; i++ {
		_, err := ts.CreateAttachment(ctx, &store.Attachment{
			UID:       shortuuid.New(),
			CreatorID: 101,
			Filename:  fmt.Sprintf("test%d.png", i),
			Blob:      []byte("test"),
			Type:      "image/png",
			Size:      int64(1000 + i),
		})
		require.NoError(t, err)
	}

	// Test limit
	limit := 3
	attachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Limit:     &limit,
	})
	require.NoError(t, err)
	require.Equal(t, 3, len(attachments))

	// Test offset
	offset := 2
	offsetAttachments, err := ts.ListAttachments(ctx, &store.FindAttachment{
		CreatorID: &[]int32{101}[0],
		Limit:     &limit,
		Offset:    &offset,
	})
	require.NoError(t, err)
	require.Equal(t, 3, len(offsetAttachments))

	ts.Close()
}

func TestAttachmentInvalidUID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)

	// Create with invalid UID (contains spaces)
	_, err := ts.CreateAttachment(ctx, &store.Attachment{
		UID:       "invalid uid with spaces",
		CreatorID: 101,
		Filename:  "test.png",
		Blob:      []byte("test"),
		Type:      "image/png",
		Size:      1000,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid uid")

	ts.Close()
}

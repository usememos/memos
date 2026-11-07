package api

import (
	"context"
	"io"
	"log/slog"
	"os"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/core/access"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Replacing an attachment's content (UploadAttachmentSpec.replace_attachment)
// keeps the attachment's identity: its name, memo binding, creator and
// creation time. The new file is written as a separate storage object first,
// the row is pointed at it in one update, and only then is the previous object
// deleted, so a failure at any step leaves one complete file behind. Thumbnails
// and other derived files are keyed by the attachment UID and are dropped with
// the previous object.

// attachmentReplaceLocks serializes replacements of one attachment within the
// process, so each one deletes exactly the object the previous one left. Locks
// are reference counted and dropped when no replacement of the UID is running.
type attachmentReplaceLocks struct {
	mu    sync.Mutex
	locks map[string]*attachmentReplaceLock
}

type attachmentReplaceLock struct {
	sync.Mutex
	holders int
}

// lock blocks until no other replacement of uid runs, and returns its release.
func (l *attachmentReplaceLocks) lock(uid string) func() {
	l.mu.Lock()
	if l.locks == nil {
		l.locks = map[string]*attachmentReplaceLock{}
	}
	entry := l.locks[uid]
	if entry == nil {
		entry = &attachmentReplaceLock{}
		l.locks[uid] = entry
	}
	entry.holders++
	l.mu.Unlock()

	entry.Lock()
	return func() {
		entry.Unlock()
		l.mu.Lock()
		if entry.holders--; entry.holders == 0 {
			delete(l.locks, uid)
		}
		l.mu.Unlock()
	}
}

// validateReplaceSpec checks the parts of an upload spec that a replacement
// fixes: the identity and the memo binding come from the replaced attachment.
func validateReplaceSpec(spec *apipb.UploadAttachmentSpec) error {
	if spec.AttachmentId != "" {
		return status.Errorf(codes.InvalidArgument, "attachment_id must be empty when replacing an attachment")
	}
	if spec.Attachment.GetMemo() != "" {
		return status.Errorf(codes.InvalidArgument, "attachment.memo must be empty when replacing an attachment")
	}
	if spec.Attachment.GetMotionMedia() != nil {
		return status.Errorf(codes.InvalidArgument, "a replacement cannot be part of a motion photo")
	}
	return nil
}

// findReplaceableAttachment loads the attachment a replacement targets and
// checks that the current user may replace its content.
func (s *APIService) findReplaceableAttachment(ctx context.Context, name string) (*store.Attachment, *store.User, error) {
	uid, err := ExtractAttachmentUIDFromName(name)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid replace_attachment: %v", err)
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
	}
	if attachment == nil {
		return nil, nil, status.Errorf(codes.NotFound, "attachment not found")
	}
	if !access.CanManageAttachment(user, attachment) {
		return nil, nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
		return nil, nil, status.Errorf(codes.FailedPrecondition, "an external link has no stored content to replace")
	}
	if attachment.Payload.GetMotionMedia() != nil {
		return nil, nil, status.Errorf(codes.FailedPrecondition, "part of a motion photo cannot be replaced")
	}
	return attachment, user, nil
}

// finishAttachmentReplace stores a finished upload as the new content of the
// attachment it replaces.
func (s *APIService) finishAttachmentReplace(ctx context.Context, upload *attachmentUpload) (*apipb.Attachment, error) {
	release := s.attachmentReplaces.lock(upload.state.uid)
	defer release()
	// Check again at finish: the attachment may have been deleted, linked to a
	// memo the user can no longer write, or the limits may have changed.
	replaced, user, err := s.findReplaceableAttachment(ctx, "attachments/"+upload.state.uid)
	if err != nil {
		return nil, err
	}
	if err := s.checkReplaceQuota(ctx, replaced.CreatorID, upload.totalSize, replaced.Size); err != nil {
		return nil, err
	}
	setting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get storage setting: %v", err)
	}
	file, err := os.Open(upload.path)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to open upload file: %v", err)
	}
	defer file.Close()
	metadata := proto.CloneOf(upload.state.metadata)
	metadata.Content = make([]byte, min(upload.totalSize, 512))
	if _, err := io.ReadFull(file, metadata.Content); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to read attachment header: %v", err)
	}
	// Validate the filename, type and media metadata with the actual MIME type.
	// The prepared attachment carries a fresh UID, which names the new storage
	// object apart from the one it replaces until the row points at it.
	content, err := s.prepareAttachment(ctx, &apipb.CreateAttachmentRequest{Attachment: metadata})
	if err != nil {
		return nil, err
	}
	content.Size = upload.totalSize
	upload.state.finalizeAttempted = true
	// A replacement is never part of a motion photo: a motion JPEG is stored as
	// a plain, EXIF-stripped image.
	if err := s.processAndStoreContent(ctx, content, setting, file, false); err != nil {
		return nil, err
	}
	// From here the new object is the attachment's, under the replaced UID.
	content.UID = replaced.UID
	// discardContent removes the new object when no row points at it. It checks
	// the row first, so an update that committed before failing keeps its object.
	discardContent := func(reason string) {
		if _, err := cleanupSavedAttachmentBlob(ctx, s.Store, content, setting); err != nil {
			slog.Error("failed to remove replacement content "+reason,
				slog.String("attachment_uid", replaced.UID),
				slog.Any("error", err),
			)
		}
	}
	payload := content.Payload
	if payload == nil {
		// The previous payload described the previous object; none of it carries over.
		payload = &storepb.AttachmentPayload{}
	}

	nowSec := time.Now().Unix()
	if err := s.Store.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID:        replaced.ID,
		UpdatedTs: &nowSec,
		Filename:  &content.Filename,
		Payload:   payload,
		Content: &store.AttachmentContent{
			Type:        content.Type,
			Size:        content.Size,
			StorageType: content.StorageType,
			Reference:   content.Reference,
			Blob:        content.Blob,
		},
		Policy: memoWritePolicy(user.ID, false),
	}); err != nil {
		discardContent("after the update failed")
		return nil, mapMemoWriteError(err, "failed to replace attachment content")
	}

	updated, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &replaced.UID})
	if err != nil {
		// The replacement committed; the previous object is left in place
		// rather than risk deleting the one the row now points at.
		s.SSEHub.publishMemoChanged()
		return nil, status.Errorf(codes.Internal, "attachment content was replaced but failed to reload: %v", err)
	}
	if updated == nil {
		// The attachment was deleted while its content was being replaced: the
		// update matched no row, so nothing points at the new object.
		discardContent("of a deleted attachment")
		return nil, status.Errorf(codes.NotFound, "attachment not found")
	}
	if hasSameManagedStorageObject(replaced, updated) {
		s.Store.DeleteAttachmentDerivedCaches(replaced)
	} else if err := s.Store.DeleteAttachmentStorageWithInstanceSetting(ctx, replaced, setting); err != nil {
		// The attachment is consistent; the previous file is only orphaned.
		slog.Warn("failed to delete replaced attachment content",
			slog.String("attachment_uid", replaced.UID),
			slog.String("storage_type", replaced.StorageType.String()),
			slog.Any("error", err),
		)
		s.Store.DeleteAttachmentDerivedCaches(replaced)
	}
	if updated.MemoID != nil {
		s.SSEHub.publishMemoChanged()
	}
	return convertAttachmentFromStore(updated), nil
}

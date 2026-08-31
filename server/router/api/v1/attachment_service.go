package v1

import (
	"context"
	"encoding/binary"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	MaxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024

	// defaultJPEGQuality is the JPEG quality used when re-encoding images for EXIF stripping.
	// Quality 95 maintains visual quality while ensuring metadata is removed.
	defaultJPEGQuality        = 95
	maxBatchDeleteAttachments = 100
	maxImagePixels            = 50_000_000
)

// exifCapableImageTypes defines image formats that may contain EXIF metadata.
// These formats will have their EXIF metadata stripped on upload for privacy.
var exifCapableImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/tiff": true,
	"image/webp": true,
	"image/heic": true,
	"image/heif": true,
}

// extensionMimeTypeFallbacks maps image extensions that Go's builtin MIME
// table does not cover. HEIC/HEIF files are the common case: browsers report
// an empty MIME type for them, Go's builtin table omits the extension, and
// http.DetectContentType cannot sniff the ISO BMFF container, so without
// this fallback these uploads are stored as "application/octet-stream" on
// minimal runtimes that ship no system MIME database (e.g. the Alpine image).
var extensionMimeTypeFallbacks = map[string]string{
	".heic": "image/heic",
	".heif": "image/heif",
}

// detectAttachmentMimeType resolves the MIME type for an uploaded file that
// arrived without a client-supplied type. It prefers the filename extension
// (including the curated fallback above, which keeps the result identical on
// machines with and without a system MIME database), then sniffs the content
// as a last resort.
func detectAttachmentMimeType(filename string, content []byte) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if mimeType, ok := extensionMimeTypeFallbacks[ext]; ok {
		return mimeType
	}
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	return http.DetectContentType(content)
}

func (s *APIV1Service) CreateAttachment(ctx context.Context, request *v1pb.CreateAttachmentRequest) (*v1pb.Attachment, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Validate required fields
	if request.Attachment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "attachment is required")
	}
	if request.Attachment.Filename == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filename is required")
	}
	if !validateFilename(request.Attachment.Filename) {
		return nil, status.Errorf(codes.InvalidArgument, "filename contains invalid characters or format")
	}
	normalizedMimeType := request.Attachment.Type
	if normalizedMimeType == "" {
		mimeType := detectAttachmentMimeType(request.Attachment.Filename, request.Attachment.Content)
		if normalizedType, ok := normalizeMimeType(mimeType); ok {
			normalizedMimeType = normalizedType
		}
	}
	if normalizedMimeType == "" {
		normalizedMimeType = "application/octet-stream"
	}
	normalizedType, ok := normalizeMimeType(normalizedMimeType)
	if !ok {
		return nil, status.Errorf(codes.InvalidArgument, "invalid MIME type format")
	}
	request.Attachment.Type = normalizedType

	attachmentUID, err := ValidateAndGenerateUID(request.AttachmentId)
	if err != nil {
		return nil, err
	}

	create := &store.Attachment{
		UID:       attachmentUID,
		CreatorID: user.ID,
		Filename:  request.Attachment.Filename,
		Type:      request.Attachment.Type,
	}

	inputMotionMedia, err := validateClientMotionMedia(request.Attachment.MotionMedia, attachmentUID)
	if err != nil {
		return nil, err
	}
	if inputMotionMedia != nil {
		create.Payload = ensureAttachmentPayload(create.Payload)
		create.Payload.MotionMedia = inputMotionMedia
	}
	inputMediaMetadata, err := validateClientMediaMetadata(request.Attachment.MediaMetadata, request.Attachment.Type)
	if err != nil {
		return nil, err
	}
	if inputMediaMetadata != nil {
		create.Payload = ensureAttachmentPayload(create.Payload)
		create.Payload.MediaMetadata = inputMediaMetadata
	}

	instanceStorageSetting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance storage setting: %v", err)
	}
	size := binary.Size(request.Attachment.Content)
	uploadSizeLimit := int(instanceStorageSetting.UploadSizeLimitMb) * MebiByte
	if uploadSizeLimit == 0 {
		uploadSizeLimit = MaxUploadBufferSizeBytes
	}
	if size > uploadSizeLimit {
		return nil, status.Errorf(codes.InvalidArgument, "file size exceeds the limit")
	}
	create.Size = int64(size)
	create.Blob = request.Attachment.Content

	if request.Attachment.Memo != nil {
		memoUID, err := ExtractMemoUIDFromName(*request.Attachment.Memo)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
		}
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to find memo: %v", err)
		}
		if memo == nil {
			return nil, status.Errorf(codes.NotFound, "memo not found: %s", *request.Attachment.Memo)
		}
		if !canModifyMemo(user, memo) {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		if err := s.requireAssignedMemoWritable(ctx, memo, user.ID); err != nil {
			return nil, err
		}
		create.MemoID = &memo.ID
		create.Policy = memoWritePolicy(user.ID, false)
	}

	if create.Payload == nil || create.Payload.MotionMedia == nil {
		if detectedMotion := detectAndroidMotionMedia(create.Blob, create.Type, attachmentUID); detectedMotion != nil {
			create.Payload = ensureAttachmentPayload(create.Payload)
			create.Payload.MotionMedia = detectedMotion
		}
	}

	// Strip EXIF metadata from images for privacy protection.
	// This removes sensitive information like GPS location, device details, etc.
	if shouldStripExif(create.Type) && !isAndroidMotionContainer(create.Payload.GetMotionMedia()) {
		release, err := s.acquireImageProcessingSlot(ctx)
		if err != nil {
			return nil, status.Errorf(codes.ResourceExhausted, "too many image processing requests")
		}
		strippedBlob, stripErr := stripImageExif(create.Blob, create.Type)
		release()
		if stripErr != nil {
			// Log warning but continue with original image to ensure uploads don't fail.
			slog.Warn("failed to strip EXIF metadata from image",
				slog.String("type", create.Type),
				slog.String("filename", create.Filename),
				slog.String("error", stripErr.Error()))
		} else {
			create.Blob = strippedBlob
			create.Size = int64(len(strippedBlob))
		}
	}

	if err := saveAttachmentBlobWithInstanceStorageSetting(ctx, s.Profile, s.Store, create, instanceStorageSetting); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save attachment blob: %v", err)
	}

	attachment, err := s.Store.CreateAttachment(ctx, create)
	if err != nil {
		createErr := mapMemoWriteError(err, "failed to create attachment")
		persistedObject, cleanupErr := cleanupSavedAttachmentBlob(ctx, s.Store, create, instanceStorageSetting)
		if cleanupErr != nil {
			slog.Error("failed to compensate attachment storage after database create failure",
				slog.String("attachment_uid", create.UID),
				slog.String("storage_type", create.StorageType.String()),
				slog.Any("error", cleanupErr),
			)
		} else if persistedObject {
			slog.Warn("attachment create returned an error after its storage object was persisted in the database; skipping compensation",
				slog.String("attachment_uid", create.UID),
				slog.String("storage_type", create.StorageType.String()),
			)
		}
		return nil, createErr
	}
	if create.MemoID != nil {
		s.SSEHub.publishMemoChanged()
	}

	return convertAttachmentFromStore(attachment), nil
}

func (s *APIV1Service) ListAttachments(ctx context.Context, request *v1pb.ListAttachmentsRequest) (*v1pb.ListAttachmentsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	pageSize := normalizePageSize(request.PageSize)

	// Parse page token for offset
	offset := 0
	if request.PageToken != "" {
		// Simple implementation: page token is the offset as string
		// In production, you might want to use encrypted tokens
		if parsed, err := fmt.Sscanf(request.PageToken, "%d", &offset); err != nil || parsed != 1 {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token")
		}
	}

	findAttachment := &store.FindAttachment{
		CreatorID: &user.ID,
		Access:    newMemoAccessScope(user, true),
		Limit:     &pageSize,
		Offset:    &offset,
	}
	// Parse filter if provided
	if request.Filter != "" {
		if err := s.validateAttachmentFilterForUser(ctx, request.Filter, user); err != nil {
			return nil, err
		}
		findAttachment.Filters = append(findAttachment.Filters, request.Filter)
	}

	attachments, err := s.Store.ListAttachments(ctx, findAttachment)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments: %v", err)
	}

	response := &v1pb.ListAttachmentsResponse{}

	for _, attachment := range attachments {
		response.Attachments = append(response.Attachments, convertAttachmentFromStore(attachment))
	}

	// Set next page token if we got the full page size (indicating there might be more)
	if len(attachments) == pageSize {
		response.NextPageToken = fmt.Sprintf("%d", offset+pageSize)
	}

	return response, nil
}

func (s *APIV1Service) GetAttachment(ctx context.Context, request *v1pb.GetAttachmentRequest) (*v1pb.Attachment, error) {
	attachmentUID, err := ExtractAttachmentUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
	}
	if attachment == nil {
		return nil, status.Errorf(codes.NotFound, "attachment not found")
	}

	// Check access permission based on linked memo visibility.
	if err := s.checkAttachmentAccess(ctx, attachment); err != nil {
		return nil, err
	}

	return convertAttachmentFromStore(attachment), nil
}

func (s *APIV1Service) UpdateAttachment(ctx context.Context, request *v1pb.UpdateAttachmentRequest) (*v1pb.Attachment, error) {
	attachmentUID, err := ExtractAttachmentUIDFromName(request.Attachment.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
	}
	if attachment == nil {
		return nil, status.Errorf(codes.NotFound, "attachment not found")
	}
	// Only the creator can update the attachment.
	if attachment.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	currentTsSec := time.Now().Unix()
	update := &store.UpdateAttachment{
		ID:        attachment.ID,
		UpdatedTs: &currentTsSec,
		Policy:    memoWritePolicy(user.ID, false),
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "filename" {
			if !validateFilename(request.Attachment.Filename) {
				return nil, status.Errorf(codes.InvalidArgument, "filename contains invalid characters or format")
			}
			update.Filename = &request.Attachment.Filename
		}
	}

	if err := s.Store.UpdateAttachment(ctx, update); err != nil {
		return nil, mapMemoWriteError(err, "failed to update attachment")
	}
	updatedAttachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	if err != nil {
		// The update already committed, and the current memo binding is unknown.
		// Publish conservatively so clients do not retain stale memo state.
		s.SSEHub.publishMemoChanged()
		return nil, status.Errorf(codes.Internal, "attachment was updated but failed to reload: %v", err)
	}
	if updatedAttachment == nil {
		s.SSEHub.publishMemoChanged()
		return nil, status.Error(codes.Internal, "attachment was updated but no longer exists")
	}
	if updatedAttachment.MemoID != nil {
		s.SSEHub.publishMemoChanged()
	}
	return convertAttachmentFromStore(updatedAttachment), nil
}

func (s *APIV1Service) DeleteAttachment(ctx context.Context, request *v1pb.DeleteAttachmentRequest) (*emptypb.Empty, error) {
	attachmentUID, err := ExtractAttachmentUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{
		UID:       &attachmentUID,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find attachment: %v", err)
	}
	if attachment == nil {
		return nil, status.Errorf(codes.NotFound, "attachment not found")
	}
	attachments := []*store.Attachment{attachment}
	if err := s.deleteAttachmentsAtomically(ctx, user, attachments); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) BatchDeleteAttachments(ctx context.Context, request *v1pb.BatchDeleteAttachmentsRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if len(request.Names) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "attachment names are required")
	}
	if len(request.Names) > maxBatchDeleteAttachments {
		return nil, status.Errorf(codes.InvalidArgument, "too many attachment names; max %d", maxBatchDeleteAttachments)
	}

	attachments := make([]*store.Attachment, 0, len(request.Names))
	seen := make(map[string]bool, len(request.Names))
	for _, name := range request.Names {
		if name == "" {
			return nil, status.Errorf(codes.InvalidArgument, "attachment name is required")
		}
		if seen[name] {
			continue
		}
		seen[name] = true

		attachmentUID, err := ExtractAttachmentUIDFromName(name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
		}
		attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
		}
		if attachment == nil {
			return nil, status.Errorf(codes.NotFound, "attachment not found")
		}
		if attachment.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		attachments = append(attachments, attachment)
	}
	if err := s.deleteAttachmentsAtomically(ctx, user, attachments); err != nil {
		return nil, err
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) validateAttachmentDeletionPreflight(ctx context.Context, user *store.User, attachments []*store.Attachment) (map[int32]string, error) {
	deletingUIDs, err := s.validateAttachmentMotionGroupDeletion(ctx, user, attachments)
	if err != nil {
		return nil, err
	}

	memos := make(map[int32]*store.Memo)
	for _, attachment := range attachments {
		if attachment.MemoID == nil {
			continue
		}
		memo := memos[*attachment.MemoID]
		if memo == nil {
			var err error
			memo, err = s.Store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get attachment memo: %v", err)
			}
			if memo == nil {
				return nil, status.Errorf(codes.FailedPrecondition, "attachment memo no longer exists")
			}
			memos[memo.ID] = memo
		}
		if memo.CreatorID != user.ID {
			return nil, status.Error(codes.PermissionDenied, "permission denied")
		}
	}
	expectedMemoContents := make(map[int32]string, len(memos))
	for _, memo := range memos {
		expectedMemoContents[memo.ID] = memo.Content
		references, err := s.extractManagedAttachmentReferences(memo.Content)
		if err != nil {
			return nil, status.Errorf(codes.FailedPrecondition, "memo contains an invalid managed attachment reference: %v", err)
		}
		for _, reference := range references {
			if _, deleting := deletingUIDs[reference.UID]; deleting {
				return nil, status.Errorf(codes.FailedPrecondition, "attachment %s is referenced by memo content", reference.UID)
			}
		}
	}

	return expectedMemoContents, nil
}

func (s *APIV1Service) validateAttachmentMotionGroupDeletion(
	ctx context.Context,
	user *store.User,
	attachments []*store.Attachment,
) (map[string]struct{}, error) {
	if user == nil || len(attachments) == 0 {
		return nil, status.Error(codes.InvalidArgument, "attachments are required")
	}
	deletingUIDs := make(map[string]struct{}, len(attachments))
	motionGroupIDs := make(map[string]struct{})
	for _, attachment := range attachments {
		if attachment == nil || attachment.ID <= 0 || attachment.UID == "" {
			return nil, status.Error(codes.InvalidArgument, "invalid attachment")
		}
		if attachment.CreatorID != user.ID {
			return nil, status.Error(codes.PermissionDenied, "permission denied")
		}
		deletingUIDs[attachment.UID] = struct{}{}
		if motion := getAttachmentMotionMedia(attachment); motion != nil && motion.GroupId != "" {
			motionGroupIDs[motion.GroupId] = struct{}{}
		}
	}
	if len(motionGroupIDs) == 0 {
		return deletingUIDs, nil
	}

	creatorAttachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{CreatorID: &user.ID, SkipDefaultLimit: true})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list motion media group: %v", err)
	}
	for _, candidate := range creatorAttachments {
		motion := getAttachmentMotionMedia(candidate)
		if motion == nil {
			continue
		}
		if _, selectedGroup := motionGroupIDs[motion.GroupId]; !selectedGroup {
			continue
		}
		if _, deleting := deletingUIDs[candidate.UID]; !deleting {
			return nil, status.Errorf(codes.FailedPrecondition, "motion media group %s must be deleted together", motion.GroupId)
		}
	}
	return deletingUIDs, nil
}

func (s *APIV1Service) deleteAttachmentsAtomically(ctx context.Context, user *store.User, attachments []*store.Attachment) error {
	expectedMemoContents, err := s.validateAttachmentDeletionPreflight(ctx, user, attachments)
	if err != nil {
		return err
	}
	attachmentIDs := make([]int32, 0, len(attachments))
	for _, attachment := range attachments {
		attachmentIDs = append(attachmentIDs, attachment.ID)
	}
	if err := s.Store.DeleteAttachmentsWithPolicy(ctx, &store.AttachmentDeletionPolicy{
		ActorUserID:          user.ID,
		ExpectedMemoContents: expectedMemoContents,
	}, attachmentIDs); err != nil {
		return mapMemoWriteError(err, "failed to delete attachments")
	}
	if attachmentsIncludeMemo(attachments) {
		s.SSEHub.publishMemoChanged()
	}
	if err := s.cleanupDeletedAttachmentStorage(ctx, attachments); err != nil {
		return status.Errorf(codes.Internal, "attachments were deleted but storage cleanup failed: %v", err)
	}
	return nil
}

func attachmentsIncludeMemo(attachments []*store.Attachment) bool {
	for _, attachment := range attachments {
		if attachment != nil && attachment.MemoID != nil {
			return true
		}
	}
	return false
}

// checkAttachmentAccess verifies the user has permission to access the attachment.
// For unlinked attachments (no memo), only the creator can access.
// For linked attachments, access follows the memo's visibility rules.
func (s *APIV1Service) checkAttachmentAccess(ctx context.Context, attachment *store.Attachment) error {
	// For unlinked attachments, only the creator can access.
	if attachment.MemoID == nil {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to get current user")
		}
		if user == nil {
			return status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		if attachment.CreatorID != user.ID {
			return status.Errorf(codes.PermissionDenied, "permission denied")
		}
		return nil
	}

	// For linked attachments, check memo visibility.
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: attachment.MemoID})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return status.Errorf(codes.NotFound, "memo not found")
	}

	return s.checkMemoReadAccess(ctx, memo)
}

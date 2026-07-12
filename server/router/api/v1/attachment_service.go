package v1

import (
	"context"
	"encoding/binary"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/filter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	MaxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024
	// ThumbnailCacheFolder is the folder name where the thumbnail images are stored.
	ThumbnailCacheFolder = ".thumbnail_cache"

	// defaultJPEGQuality is the JPEG quality used when re-encoding images for EXIF stripping.
	// Quality 95 maintains visual quality while ensuring metadata is removed.
	defaultJPEGQuality        = 95
	maxBatchDeleteAttachments = 100
	maxImagePixels            = 50_000_000
)

var SupportedThumbnailMimeTypes = []string{
	"image/png",
	"image/jpeg",
}

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
		ext := filepath.Ext(request.Attachment.Filename)
		mimeType := mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = http.DetectContentType(request.Attachment.Content)
		}
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
		create.MemoID = &memo.ID
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

	if err := SaveAttachmentBlob(ctx, s.Profile, s.Store, create); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save attachment blob: %v", err)
	}

	attachment, err := s.Store.CreateAttachment(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create attachment: %v", err)
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
		Limit:     &pageSize,
		Offset:    &offset,
	}

	// Parse filter if provided
	if request.Filter != "" {
		if err := s.validateAttachmentFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
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
	// Only the creator or admin can update the attachment.
	if attachment.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateAttachment{
		ID:        attachment.ID,
		UpdatedTs: &currentTs,
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
		return nil, status.Errorf(codes.Internal, "failed to update attachment: %v", err)
	}
	return s.GetAttachment(ctx, &v1pb.GetAttachmentRequest{
		Name: request.Attachment.Name,
	})
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
	// Delete the attachment from the database.
	if err := s.Store.DeleteAttachment(ctx, &store.DeleteAttachment{
		ID: attachment.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete attachment: %v", err)
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
		if attachment.CreatorID != user.ID && !isSuperUser(user) {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		attachments = append(attachments, attachment)
	}

	if err := s.Store.DeleteAttachments(ctx, attachments); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete attachments: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) validateAttachmentFilter(ctx context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}

	engine, err := filter.DefaultAttachmentEngine()
	if err != nil {
		return err
	}

	var dialect filter.DialectName
	switch s.Profile.Driver {
	case "mysql":
		dialect = filter.DialectMySQL
	case "postgres":
		dialect = filter.DialectPostgres
	default:
		dialect = filter.DialectSQLite
	}

	if _, err := engine.CompileToStatement(ctx, filterStr, filter.RenderOptions{Dialect: dialect}); err != nil {
		return errors.Wrap(err, "failed to compile filter")
	}
	return nil
}

// checkAttachmentAccess verifies the user has permission to access the attachment.
// For unlinked attachments (no memo), only the creator can access.
// For linked attachments, access follows the memo's visibility rules.
func (s *APIV1Service) checkAttachmentAccess(ctx context.Context, attachment *store.Attachment) error {
	user, _ := s.fetchCurrentUser(ctx)

	// For unlinked attachments, only the creator can access.
	if attachment.MemoID == nil {
		if user == nil {
			return status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		if attachment.CreatorID != user.ID && !isSuperUser(user) {
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

	if memo.Visibility == store.Public {
		return nil
	}
	if user == nil {
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if memo.Visibility == store.Private && memo.CreatorID != user.ID && !isSuperUser(user) {
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return nil
}

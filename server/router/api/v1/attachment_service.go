package v1

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/filter"
	"github.com/usememos/memos/plugin/storage/s3"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
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
	defaultJPEGQuality = 95
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
	if request.Attachment.Type == "" {
		ext := filepath.Ext(request.Attachment.Filename)
		mimeType := mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = http.DetectContentType(request.Attachment.Content)
		}
		// ParseMediaType to strip parameters
		mediaType, _, err := mime.ParseMediaType(mimeType)
		if err == nil {
			request.Attachment.Type = mediaType
		}
	}
	if request.Attachment.Type == "" {
		request.Attachment.Type = "application/octet-stream"
	}
	if !isValidMimeType(request.Attachment.Type) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid MIME type format")
	}

	// Use provided attachment_id or generate a new one
	attachmentUID := request.AttachmentId
	if attachmentUID == "" {
		attachmentUID = shortuuid.New()
	}

	create := &store.Attachment{
		UID:       attachmentUID,
		CreatorID: user.ID,
		Filename:  request.Attachment.Filename,
		Type:      request.Attachment.Type,
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

	// Strip EXIF metadata from images for privacy protection.
	// This removes sensitive information like GPS location, device details, etc.
	if shouldStripExif(create.Type) {
		if strippedBlob, err := stripImageExif(create.Blob, create.Type); err != nil {
			// Log warning but continue with original image to ensure uploads don't fail.
			slog.Warn("failed to strip EXIF metadata from image",
				slog.String("type", create.Type),
				slog.String("filename", create.Filename),
				slog.String("error", err.Error()))
		} else {
			create.Blob = strippedBlob
			create.Size = int64(len(strippedBlob))
		}
	}

	if err := SaveAttachmentBlob(ctx, s.Profile, s.Store, create); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save attachment blob: %v", err)
	}

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
		create.MemoID = &memo.ID
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

	// Set default page size
	pageSize := int(request.PageSize)
	if pageSize <= 0 {
		pageSize = 50
	}
	if pageSize > 1000 {
		pageSize = 1000
	}

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

	// For simplicity, set total size to the number of returned attachments.
	// In a full implementation, you'd want a separate count query
	response.TotalSize = int32(len(response.Attachments))

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

func convertAttachmentFromStore(attachment *store.Attachment) *v1pb.Attachment {
	attachmentMessage := &v1pb.Attachment{
		Name:       fmt.Sprintf("%s%s", AttachmentNamePrefix, attachment.UID),
		CreateTime: timestamppb.New(time.Unix(attachment.CreatedTs, 0)),
		Filename:   attachment.Filename,
		Type:       attachment.Type,
		Size:       attachment.Size,
	}
	if attachment.MemoUID != nil && *attachment.MemoUID != "" {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, *attachment.MemoUID)
		attachmentMessage.Memo = &memoName
	}
	if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL || attachment.StorageType == storepb.AttachmentStorageType_S3 {
		attachmentMessage.ExternalLink = attachment.Reference
	}

	return attachmentMessage
}

// SaveAttachmentBlob save the blob of attachment based on the storage config.
func SaveAttachmentBlob(ctx context.Context, profile *profile.Profile, stores *store.Store, create *store.Attachment) error {
	instanceStorageSetting, err := stores.GetInstanceStorageSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "Failed to find instance storage setting")
	}

	if instanceStorageSetting.StorageType == storepb.InstanceStorageSetting_LOCAL {
		filepathTemplate := "assets/{timestamp}_{filename}"
		if instanceStorageSetting.FilepathTemplate != "" {
			filepathTemplate = instanceStorageSetting.FilepathTemplate
		}

		internalPath := filepathTemplate
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replaceFilenameWithPathTemplate(internalPath, create.Filename)
		internalPath = filepath.ToSlash(internalPath)

		// Ensure the directory exists.
		osPath := filepath.FromSlash(internalPath)
		if !filepath.IsAbs(osPath) {
			osPath = filepath.Join(profile.Data, osPath)
		}
		dir := filepath.Dir(osPath)
		if err = os.MkdirAll(dir, os.ModePerm); err != nil {
			return errors.Wrap(err, "Failed to create directory")
		}

		// Write the blob to the file.
		if err := os.WriteFile(osPath, create.Blob, 0644); err != nil {
			return errors.Wrap(err, "Failed to write file")
		}
		create.Reference = internalPath
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_LOCAL
	} else if instanceStorageSetting.StorageType == storepb.InstanceStorageSetting_S3 {
		s3Config := instanceStorageSetting.S3Config
		if s3Config == nil {
			return errors.Errorf("No activated external storage found")
		}
		s3Client, err := s3.NewClient(ctx, s3Config)
		if err != nil {
			return errors.Wrap(err, "Failed to create s3 client")
		}

		filepathTemplate := instanceStorageSetting.FilepathTemplate
		if !strings.Contains(filepathTemplate, "{filename}") {
			filepathTemplate = filepath.Join(filepathTemplate, "{filename}")
		}
		filepathTemplate = replaceFilenameWithPathTemplate(filepathTemplate, create.Filename)
		key, err := s3Client.UploadObject(ctx, filepathTemplate, create.Type, bytes.NewReader(create.Blob))
		if err != nil {
			return errors.Wrap(err, "Failed to upload via s3 client")
		}
		presignURL, err := s3Client.PresignGetObject(ctx, key)
		if err != nil {
			return errors.Wrap(err, "Failed to presign via s3 client")
		}

		create.Reference = presignURL
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_S3
		create.Payload = &storepb.AttachmentPayload{
			Payload: &storepb.AttachmentPayload_S3Object_{
				S3Object: &storepb.AttachmentPayload_S3Object{
					S3Config:          s3Config,
					Key:               key,
					LastPresignedTime: timestamppb.New(time.Now()),
				},
			},
		}
	}

	return nil
}

func (s *APIV1Service) GetAttachmentBlob(attachment *store.Attachment) ([]byte, error) {
	// For local storage, read the file from the local disk.
	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		attachmentPath := filepath.FromSlash(attachment.Reference)
		if !filepath.IsAbs(attachmentPath) {
			attachmentPath = filepath.Join(s.Profile.Data, attachmentPath)
		}

		file, err := os.Open(attachmentPath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		defer file.Close()
		blob, err := io.ReadAll(file)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read the file")
		}
		return blob, nil
	}
	// For S3 storage, download the file from S3.
	if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		if attachment.Payload == nil {
			return nil, errors.New("attachment payload is missing")
		}
		s3Object := attachment.Payload.GetS3Object()
		if s3Object == nil {
			return nil, errors.New("S3 object payload is missing")
		}
		if s3Object.S3Config == nil {
			return nil, errors.New("S3 config is missing")
		}
		if s3Object.Key == "" {
			return nil, errors.New("S3 object key is missing")
		}

		s3Client, err := s3.NewClient(context.Background(), s3Object.S3Config)
		if err != nil {
			return nil, errors.Wrap(err, "failed to create S3 client")
		}

		blob, err := s3Client.GetObject(context.Background(), s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get object from S3")
		}
		return blob, nil
	}
	// For database storage, return the blob from the database.
	return attachment.Blob, nil
}

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func replaceFilenameWithPathTemplate(path, filename string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{filename}":
			return filename
		case "{timestamp}":
			return fmt.Sprintf("%d", t.Unix())
		case "{year}":
			return fmt.Sprintf("%d", t.Year())
		case "{month}":
			return fmt.Sprintf("%02d", t.Month())
		case "{day}":
			return fmt.Sprintf("%02d", t.Day())
		case "{hour}":
			return fmt.Sprintf("%02d", t.Hour())
		case "{minute}":
			return fmt.Sprintf("%02d", t.Minute())
		case "{second}":
			return fmt.Sprintf("%02d", t.Second())
		case "{uuid}":
			return util.GenUUID()
		default:
			return s
		}
	})
	return path
}

func validateFilename(filename string) bool {
	// Reject path traversal attempts and make sure no additional directories are created
	if !filepath.IsLocal(filename) || strings.ContainsAny(filename, "/\\") {
		return false
	}

	// Reject filenames starting or ending with spaces or periods
	if strings.HasPrefix(filename, " ") || strings.HasSuffix(filename, " ") ||
		strings.HasPrefix(filename, ".") || strings.HasSuffix(filename, ".") {
		return false
	}

	return true
}

func isValidMimeType(mimeType string) bool {
	// Reject empty or excessively long MIME types
	if mimeType == "" || len(mimeType) > 255 {
		return false
	}

	// MIME type must match the pattern: type/subtype
	// Allow common characters in MIME types per RFC 2045
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}$`, mimeType)
	return matched
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

// shouldStripExif checks if the MIME type is an image format that may contain EXIF metadata.
// Returns true for formats like JPEG, TIFF, WebP, HEIC, and HEIF which commonly contain
// privacy-sensitive metadata such as GPS coordinates, camera settings, and device information.
func shouldStripExif(mimeType string) bool {
	return exifCapableImageTypes[mimeType]
}

// stripImageExif removes EXIF metadata from image files by decoding and re-encoding them.
// This prevents exposure of sensitive metadata such as GPS location, camera details, and timestamps.
//
// The function preserves the correct image orientation by applying EXIF orientation tags
// during decoding before stripping all metadata. Images are re-encoded with high quality
// to minimize visual degradation.
//
// Supported formats:
//   - JPEG/JPG: Re-encoded as JPEG with quality 95
//   - PNG: Re-encoded as PNG (lossless)
//   - TIFF/WebP/HEIC/HEIF: Re-encoded as JPEG with quality 95
//
// Returns the cleaned image data without any EXIF metadata, or an error if processing fails.
func stripImageExif(imageData []byte, mimeType string) ([]byte, error) {
	// Decode image with automatic EXIF orientation correction.
	// This ensures the image displays correctly after metadata removal.
	img, err := imaging.Decode(bytes.NewReader(imageData), imaging.AutoOrientation(true))
	if err != nil {
		return nil, errors.Wrap(err, "failed to decode image")
	}

	// Re-encode the image without EXIF metadata.
	var buf bytes.Buffer
	var encodeErr error

	if mimeType == "image/png" {
		// Preserve PNG format for lossless encoding
		encodeErr = imaging.Encode(&buf, img, imaging.PNG)
	} else {
		// For JPEG, TIFF, WebP, HEIC, HEIF - re-encode as JPEG.
		// This ensures EXIF is stripped and provides good compression.
		encodeErr = imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(defaultJPEGQuality))
	}

	if encodeErr != nil {
		return nil, errors.Wrap(encodeErr, "failed to encode image")
	}

	return buf.Bytes(), nil
}

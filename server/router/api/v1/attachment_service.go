package v1

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
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
)

var SupportedThumbnailMimeTypes = []string{
	"image/png",
	"image/jpeg",
}

func (s *APIV1Service) CreateAttachment(ctx context.Context, request *v1pb.CreateAttachmentRequest) (*v1pb.Attachment, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	// Validate required fields
	if request.Attachment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "attachment is required")
	}
	if request.Attachment.Filename == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filename is required")
	}
	if request.Attachment.Type == "" {
		return nil, status.Errorf(codes.InvalidArgument, "type is required")
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

	workspaceStorageSetting, err := s.Store.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace storage setting: %v", err)
	}
	size := binary.Size(request.Attachment.Content)
	uploadSizeLimit := int(workspaceStorageSetting.UploadSizeLimitMb) * MebiByte
	if uploadSizeLimit == 0 {
		uploadSizeLimit = MaxUploadBufferSizeBytes
	}
	if size > uploadSizeLimit {
		return nil, status.Errorf(codes.InvalidArgument, "file size exceeds the limit")
	}
	create.Size = int64(size)
	create.Blob = request.Attachment.Content

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
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
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

	// Basic filter support for common cases
	if request.Filter != "" {
		// Simple filter parsing - can be enhanced later
		// For now, support basic type filtering: "type=image/png"
		if strings.HasPrefix(request.Filter, "type=") {
			filterType := strings.TrimPrefix(request.Filter, "type=")
			// Create a temporary struct to hold type filter
			// Since FindAttachment doesn't have Type field, we'll apply this post-query
			_ = filterType // We'll filter after getting results
		}
	}

	attachments, err := s.Store.ListAttachments(ctx, findAttachment)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments: %v", err)
	}

	// Apply type filter if specified
	if request.Filter != "" && strings.HasPrefix(request.Filter, "type=") {
		filterType := strings.TrimPrefix(request.Filter, "type=")
		filteredAttachments := make([]*store.Attachment, 0)
		for _, attachment := range attachments {
			if attachment.Type == filterType {
				filteredAttachments = append(filteredAttachments, attachment)
			}
		}
		attachments = filteredAttachments
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
	return convertAttachmentFromStore(attachment), nil
}

func (s *APIV1Service) GetAttachmentBinary(ctx context.Context, request *v1pb.GetAttachmentBinaryRequest) (*httpbody.HttpBody, error) {
	attachmentUID, err := ExtractAttachmentUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{
		GetBlob: true,
		UID:     &attachmentUID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
	}
	if attachment == nil {
		return nil, status.Errorf(codes.NotFound, "attachment not found")
	}
	// Check the related memo visibility.
	if attachment.MemoID != nil {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: attachment.MemoID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to find memo by ID: %v", attachment.MemoID)
		}
		if memo != nil && memo.Visibility != store.Public {
			user, err := s.GetCurrentUser(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
			}
			if user == nil {
				return nil, status.Errorf(codes.Unauthenticated, "unauthorized access")
			}
			if memo.Visibility == store.Private && user.ID != attachment.CreatorID {
				return nil, status.Errorf(codes.Unauthenticated, "unauthorized access")
			}
		}
	}

	if request.Thumbnail && util.HasPrefixes(attachment.Type, SupportedThumbnailMimeTypes...) {
		thumbnailBlob, err := s.getOrGenerateThumbnail(attachment)
		if err != nil {
			// thumbnail failures are logged as warnings and not cosidered critical failures as
			// a attachment image can be used in its place.
			slog.Warn("failed to get attachment thumbnail image", slog.Any("error", err))
		} else {
			return &httpbody.HttpBody{
				ContentType: attachment.Type,
				Data:        thumbnailBlob,
			}, nil
		}
	}

	blob, err := s.GetAttachmentBlob(attachment)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get attachment blob: %v", err)
	}

	contentType := attachment.Type
	if strings.HasPrefix(contentType, "text/") {
		contentType += "; charset=utf-8"
	}
	// Prevent XSS attacks by serving potentially unsafe files with a content type that prevents script execution.
	if strings.EqualFold(contentType, "image/svg+xml") ||
		strings.EqualFold(contentType, "text/html") ||
		strings.EqualFold(contentType, "application/xhtml+xml") {
		contentType = "application/octet-stream"
	}

	// Extract range header from gRPC metadata for iOS Safari video support
	var rangeHeader string
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		// Check for range header from gRPC-Gateway
		if ranges := md.Get("grpcgateway-range"); len(ranges) > 0 {
			rangeHeader = ranges[0]
		} else if ranges := md.Get("range"); len(ranges) > 0 {
			rangeHeader = ranges[0]
		}

		// Log for debugging iOS Safari issues
		if userAgents := md.Get("user-agent"); len(userAgents) > 0 {
			userAgent := userAgents[0]
			if strings.Contains(strings.ToLower(userAgent), "safari") && rangeHeader != "" {
				slog.Debug("Safari range request detected",
					slog.String("range", rangeHeader),
					slog.String("user-agent", userAgent),
					slog.String("content-type", contentType))
			}
		}
	}

	// Handle range requests for video/audio streaming (iOS Safari requirement)
	if rangeHeader != "" && (strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/")) {
		return s.handleRangeRequest(ctx, blob, rangeHeader, contentType)
	}

	// Set headers for streaming support
	if strings.HasPrefix(contentType, "video/") || strings.HasPrefix(contentType, "audio/") {
		if err := setResponseHeaders(ctx, map[string]string{
			"accept-ranges":  "bytes",
			"content-length": fmt.Sprintf("%d", len(blob)),
			"cache-control":  "public, max-age=3600", // 1 hour cache
		}); err != nil {
			slog.Warn("failed to set streaming headers", slog.Any("error", err))
		}
	}

	return &httpbody.HttpBody{
		ContentType: contentType,
		Data:        blob,
	}, nil
}

func (s *APIV1Service) UpdateAttachment(ctx context.Context, request *v1pb.UpdateAttachmentRequest) (*v1pb.Attachment, error) {
	attachmentUID, err := ExtractAttachmentUIDFromName(request.Attachment.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment id: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateAttachment{
		ID:        attachment.ID,
		UpdatedTs: &currentTs,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "filename" {
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
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
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
	workspaceStorageSetting, err := stores.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "Failed to find workspace storage setting")
	}

	if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_LOCAL {
		filepathTemplate := "assets/{timestamp}_{filename}"
		if workspaceStorageSetting.FilepathTemplate != "" {
			filepathTemplate = workspaceStorageSetting.FilepathTemplate
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
		dst, err := os.Create(osPath)
		if err != nil {
			return errors.Wrap(err, "Failed to create file")
		}
		defer dst.Close()

		// Write the blob to the file.
		if err := os.WriteFile(osPath, create.Blob, 0644); err != nil {
			return errors.Wrap(err, "Failed to write file")
		}
		create.Reference = internalPath
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_LOCAL
	} else if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_S3 {
		s3Config := workspaceStorageSetting.S3Config
		if s3Config == nil {
			return errors.Errorf("No actived external storage found")
		}
		s3Client, err := s3.NewClient(ctx, s3Config)
		if err != nil {
			return errors.Wrap(err, "Failed to create s3 client")
		}

		filepathTemplate := workspaceStorageSetting.FilepathTemplate
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
	// For database storage, return the blob from the database.
	return attachment.Blob, nil
}

const (
	// thumbnailRatio is the ratio of the thumbnail image.
	thumbnailRatio = 0.8
)

// getOrGenerateThumbnail returns the thumbnail image of the attachment.
func (s *APIV1Service) getOrGenerateThumbnail(attachment *store.Attachment) ([]byte, error) {
	thumbnailCacheFolder := filepath.Join(s.Profile.Data, ThumbnailCacheFolder)
	if err := os.MkdirAll(thumbnailCacheFolder, os.ModePerm); err != nil {
		return nil, errors.Wrap(err, "failed to create thumbnail cache folder")
	}
	filePath := filepath.Join(thumbnailCacheFolder, fmt.Sprintf("%d%s", attachment.ID, filepath.Ext(attachment.Filename)))
	if _, err := os.Stat(filePath); err != nil {
		if !os.IsNotExist(err) {
			return nil, errors.Wrap(err, "failed to check thumbnail image stat")
		}

		// If thumbnail image does not exist, generate and save the thumbnail image.
		blob, err := s.GetAttachmentBlob(attachment)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get attachment blob")
		}
		img, err := imaging.Decode(bytes.NewReader(blob), imaging.AutoOrientation(true))
		if err != nil {
			return nil, errors.Wrap(err, "failed to decode thumbnail image")
		}

		thumbnailWidth := int(float64(img.Bounds().Dx()) * thumbnailRatio)
		// Resize the image to the thumbnailWidth.
		thumbnailImage := imaging.Resize(img, thumbnailWidth, 0, imaging.Lanczos)
		if err := imaging.Save(thumbnailImage, filePath); err != nil {
			return nil, errors.Wrap(err, "failed to save thumbnail file")
		}
	}

	thumbnailFile, err := os.Open(filePath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open thumbnail file")
	}
	defer thumbnailFile.Close()
	blob, err := io.ReadAll(thumbnailFile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read thumbnail file")
	}
	return blob, nil
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

// handleRangeRequest handles HTTP range requests for video/audio streaming (iOS Safari requirement).
func (*APIV1Service) handleRangeRequest(ctx context.Context, data []byte, rangeHeader, contentType string) (*httpbody.HttpBody, error) {
	// Parse "bytes=start-end"
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return nil, status.Errorf(codes.InvalidArgument, "invalid range header format")
	}

	rangeSpec := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.Split(rangeSpec, "-")
	if len(parts) != 2 {
		return nil, status.Errorf(codes.InvalidArgument, "invalid range specification")
	}

	fileSize := int64(len(data))
	start, end := int64(0), fileSize-1

	// Parse start position
	if parts[0] != "" {
		if s, err := strconv.ParseInt(parts[0], 10, 64); err == nil {
			start = s
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "invalid range start: %s", parts[0])
		}
	}

	// Parse end position
	if parts[1] != "" {
		if e, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
			end = e
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "invalid range end: %s", parts[1])
		}
	}

	// Validate range
	if start < 0 || end >= fileSize || start > end {
		// Set Content-Range header for 416 response
		if err := setResponseHeaders(ctx, map[string]string{
			"content-range": fmt.Sprintf("bytes */%d", fileSize),
		}); err != nil {
			slog.Warn("failed to set content-range header", slog.Any("error", err))
		}
		return nil, status.Errorf(codes.OutOfRange, "requested range not satisfiable")
	}

	// Set partial content headers (HTTP 206)
	if err := setResponseHeaders(ctx, map[string]string{
		"accept-ranges":  "bytes",
		"content-range":  fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize),
		"content-length": fmt.Sprintf("%d", end-start+1),
		"cache-control":  "public, max-age=3600",
	}); err != nil {
		slog.Warn("failed to set partial content headers", slog.Any("error", err))
	}

	// Extract the requested range
	rangeData := data[start : end+1]

	slog.Debug("serving partial content",
		slog.Int64("start", start),
		slog.Int64("end", end),
		slog.Int64("total", fileSize),
		slog.Int("chunk_size", len(rangeData)))

	return &httpbody.HttpBody{
		ContentType: contentType,
		Data:        rangeData,
	}, nil
}

// setResponseHeaders is a helper function to set gRPC response headers.
func setResponseHeaders(ctx context.Context, headers map[string]string) error {
	pairs := make([]string, 0, len(headers)*2)
	for key, value := range headers {
		pairs = append(pairs, key, value)
	}
	return grpc.SetHeader(ctx, metadata.Pairs(pairs...))
}

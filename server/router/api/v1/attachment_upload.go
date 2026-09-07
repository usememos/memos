package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net/http"
	"os"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/labstack/echo/v5"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/internal/motionphoto"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const (
	attachmentUploadMetadataLimit = 64 << 10
	attachmentUploadOverheadLimit = 1 << 20
)

func attachmentUploadLimit(setting *storepb.InstanceStorageSetting) int64 {
	mb := setting.UploadSizeLimitMb
	if mb <= 0 {
		return MaxUploadBufferSizeBytes
	}
	// Leave room for the multipart envelope and the extra byte used to detect
	// an oversized file, even for an incorrectly configured setting.
	return min(mb, (math.MaxInt64-attachmentUploadOverheadLimit-1)/MebiByte) * MebiByte
}

type attachmentUploadLimitError struct{}

func (*attachmentUploadLimitError) Error() string { return "file size exceeds the limit" }

func (*attachmentUploadLimitError) GRPCStatus() *status.Status {
	return status.New(codes.ResourceExhausted, "file size exceeds the limit")
}

type attachmentContextReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r *attachmentContextReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.reader.Read(p)
}

// registerAttachmentUploadRoute adds a disk-backed alternative to the buffered
// CreateAttachment RPC. Metadata is a proto-JSON CreateAttachmentRequest in the
// first multipart field (metadata), followed by exactly one file field (file).
func (s *APIV1Service) registerAttachmentUploadRoute(group *echo.Group, authorizer *Authorizer) {
	group.POST(`/api/v1/attachments\:upload`, echo.WrapHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setAPIResponseNoStoreHeaders(w.Header())
		result := authorizer.Authenticate(r.Context(), r.Header.Get("Authorization"))
		if err := authorizer.CheckAccess(r.Context(), "/memos.api.v1.AttachmentService/CreateAttachment", result); err != nil {
			writeGatewayAuthorizationError(w, err)
			return
		}
		r = r.WithContext(auth.ApplyToContext(r.Context(), result))
		attachment, err := s.uploadAttachment(w, r)
		if err != nil {
			writeAttachmentUploadError(w, err)
			return
		}
		body, err := (protojson.MarshalOptions{EmitDefaultValues: true}).Marshal(attachment)
		if err != nil {
			writeAttachmentUploadError(w, status.Errorf(codes.Internal, "failed to encode attachment: %v", err))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})))
}

func writeAttachmentUploadError(w http.ResponseWriter, err error) {
	var sizeError *attachmentUploadLimitError
	var bodyError *http.MaxBytesError
	st := status.Convert(err)
	code := runtime.HTTPStatusFromCode(st.Code())
	if errors.As(err, &sizeError) || errors.As(err, &bodyError) {
		code = http.StatusRequestEntityTooLarge
		st = (&attachmentUploadLimitError{}).GRPCStatus()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{"code": st.Code(), "message": st.Message()})
}

func (s *APIV1Service) uploadAttachment(w http.ResponseWriter, r *http.Request) (*v1pb.Attachment, error) {
	ctx := r.Context()
	setting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get storage setting: %v", err)
	}
	limit := attachmentUploadLimit(setting)
	if r.ContentLength > limit+attachmentUploadOverheadLimit {
		return nil, &attachmentUploadLimitError{}
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit+attachmentUploadOverheadLimit)
	multipartReader, err := r.MultipartReader()
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "multipart/form-data is required")
	}
	metadata, err := multipartReader.NextPart()
	if err != nil || metadata.FormName() != "metadata" || metadata.FileName() != "" {
		return nil, status.Errorf(codes.InvalidArgument, "the first part must be attachment metadata")
	}
	data, err := io.ReadAll(io.LimitReader(metadata, attachmentUploadMetadataLimit+1))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read attachment metadata")
	}
	if len(data) > attachmentUploadMetadataLimit {
		return nil, status.Errorf(codes.InvalidArgument, "attachment metadata is too large")
	}
	request := &v1pb.CreateAttachmentRequest{}
	if err := protojson.Unmarshal(data, request); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid attachment metadata: %v", err)
	}
	if request.Attachment == nil || len(request.Attachment.Content) != 0 {
		return nil, status.Errorf(codes.InvalidArgument, "attachment metadata is required and must not contain file content")
	}
	if request.Attachment.Size > limit {
		return nil, &attachmentUploadLimitError{}
	}
	part, err := multipartReader.NextPart()
	if err != nil || part.FormName() != "file" {
		return nil, status.Errorf(codes.InvalidArgument, "attachment metadata must be followed by a file")
	}
	// Only the sniffing prefix is read before shared metadata and memo permission
	// validation. The RPC uses this same MIME detection and validation path.
	probe, err := io.ReadAll(io.LimitReader(part, 512))
	if err != nil {
		return nil, errors.Wrap(err, "failed to read attachment header")
	}
	request.Attachment.Content = probe
	create, err := s.prepareAttachment(ctx, request)
	if err != nil {
		return nil, err
	}
	file, err := os.CreateTemp(s.Profile.Data, ".memos-upload-*")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create upload file: %v", err)
	}
	defer os.Remove(file.Name())
	defer file.Close()
	content := io.MultiReader(bytes.NewReader(probe), part)
	create.Size, err = io.Copy(file, &attachmentContextReader{ctx: ctx, reader: io.LimitReader(content, limit+1)})
	if err != nil {
		return nil, errors.Wrap(err, "failed to receive attachment")
	}
	if create.Size > limit {
		return nil, &attachmentUploadLimitError{}
	}
	if _, err := multipartReader.NextPart(); err != io.EOF {
		return nil, status.Errorf(codes.InvalidArgument, "expected exactly one complete file part")
	}
	processed, err := s.processAttachmentFile(ctx, create, file)
	if err != nil {
		return nil, err
	}
	if processed != file {
		defer os.Remove(processed.Name())
		defer processed.Close()
	}
	if _, err := processed.Seek(0, io.SeekStart); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rewind upload: %v", err)
	}
	if err := saveAttachmentContent(ctx, s.Profile, s.Store, create, setting, processed); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save attachment: %v", err)
	}
	return s.persistAttachment(ctx, create, setting)
}

func (s *APIV1Service) processAttachmentFile(ctx context.Context, create *store.Attachment, file *os.File) (*os.File, error) {
	if create.Payload.GetMotionMedia() == nil && (create.Type == "image/jpeg" || create.Type == "image/jpg") {
		detected, err := motionphoto.DetectJPEGReader(file, create.Size)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to inspect motion photo: %v", err)
		}
		if detected != nil {
			create.Payload = ensureAttachmentPayload(create.Payload)
			create.Payload.MotionMedia = &storepb.MotionMedia{
				Family: storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO, Role: storepb.MotionMediaRole_CONTAINER,
				GroupId: create.UID, PresentationTimestampUs: detected.PresentationTimestampUs, HasEmbeddedVideo: true,
			}
		}
	}
	if !shouldStripExif(create.Type) || isAndroidMotionContainer(create.Payload.GetMotionMedia()) {
		return file, nil
	}
	release, err := s.acquireImageProcessingSlot(ctx)
	if err != nil {
		return nil, status.Errorf(codes.ResourceExhausted, "too many image processing requests")
	}
	defer release()
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rewind image: %v", err)
	}
	processed, err := os.CreateTemp(s.Profile.Data, ".memos-upload-*")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create processed image: %v", err)
	}
	if err := stripImageExifTo(processed, file, create.Type); err != nil {
		processed.Close()
		os.Remove(processed.Name())
		// Preserve the existing RPC's fallback when an image cannot be decoded.
		slog.Warn("failed to strip EXIF metadata from image", "type", create.Type, "filename", create.Filename, "error", err)
		return file, nil
	}
	info, err := processed.Stat()
	if err != nil {
		processed.Close()
		os.Remove(processed.Name())
		return nil, status.Errorf(codes.Internal, "failed to stat processed image: %v", err)
	}
	create.Size = info.Size()
	return processed, nil
}

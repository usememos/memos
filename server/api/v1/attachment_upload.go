package v1

import (
	"context"
	"io"
	"os"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	attachmentUploadMetadataLimit = 64 << 10
	attachmentUploadTempPrefix    = ".memos-rpc-upload-"
	attachmentUploadProcedure     = "/memos.api.v1.AttachmentService/UploadAttachment"
)

// attachmentUploadState is what an attachment upload carries besides its
// bytes. Only Attachment is an API resource.
type attachmentUploadState struct {
	metadata          *v1pb.Attachment
	uid               string
	finalizeAttempted bool
}

type (
	attachmentUpload  = uploadSession[attachmentUploadState]
	attachmentUploads = uploadSessions[attachmentUploadState]
)

// UploadAttachment accepts bounded unary chunks. A call carrying a spec opens
// a new upload; a call carrying an upload ID continues one. Either kind may
// write data and finalize.
func (s *APIV1Service) UploadAttachment(ctx context.Context, request *v1pb.UploadAttachmentRequest) (*v1pb.UploadAttachmentResponse, error) {
	user, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if len(request.Data) > uploadChunkSize {
		return nil, status.Errorf(codes.ResourceExhausted, "upload chunk exceeds the limit")
	}
	var id string
	var upload *attachmentUpload
	switch u := request.Upload.(type) {
	case *v1pb.UploadAttachmentRequest_Spec:
		if err := s.throttleAndCharge(ratelimit.ScopeUploadUser, userKey(user.ID), 1); err != nil {
			return nil, err
		}
		id, upload, err = s.startAttachmentUpload(ctx, request, u.Spec, user.ID)
		if err != nil {
			return nil, err
		}
		upload.mu.Lock()
	case *v1pb.UploadAttachmentRequest_UploadId:
		id = u.UploadId
		upload, err = s.attachmentUploads.resume(id, user.ID)
		if err != nil {
			return nil, err
		}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "spec or upload_id is required")
	}
	defer upload.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	if err := upload.write(request.WriteOffset, request.Data, request.FinishWrite); err != nil {
		return nil, err
	}
	var attachment *v1pb.Attachment
	if upload.complete {
		// Recheck access and existence; a completed upload must not resurrect a
		// deleted attachment or disclose metadata after access is revoked.
		attachment, err = s.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: "attachments/" + upload.state.uid})
	} else if request.FinishWrite {
		if upload.committedSize != upload.totalSize {
			return nil, status.Errorf(codes.FailedPrecondition, "upload is incomplete")
		}
		attachment, err = s.finishAttachmentUpload(ctx, upload)
		if err == nil {
			upload.complete = true
			os.Remove(upload.path)
		}
	}
	if err != nil {
		return nil, err
	}
	upload.expireTime = time.Now().Add(uploadTTL)
	return &v1pb.UploadAttachmentResponse{
		UploadId: id, CommittedSize: upload.committedSize, Attachment: attachment, MaxChunkSize: uploadChunkSize,
	}, nil
}

// startAttachmentUpload validates the spec and registers a new upload. Every
// check that can fail on the accompanying data runs first, so a rejected call
// never leaves an orphaned upload behind.
func (s *APIV1Service) startAttachmentUpload(ctx context.Context, request *v1pb.UploadAttachmentRequest, spec *v1pb.UploadAttachmentSpec, ownerID int32) (string, *attachmentUpload, error) {
	if spec.Attachment == nil {
		return "", nil, status.Errorf(codes.InvalidArgument, "spec.attachment is required")
	}
	if len(spec.Attachment.Content) != 0 {
		return "", nil, status.Errorf(codes.InvalidArgument, "spec.attachment.content must be empty; send file bytes in data")
	}
	if proto.Size(spec) > attachmentUploadMetadataLimit || spec.TotalSize < 0 {
		return "", nil, status.Errorf(codes.InvalidArgument, "invalid attachment metadata or total_size")
	}
	if request.WriteOffset != 0 {
		return "", nil, status.Errorf(codes.OutOfRange, "write_offset must be 0 for a new upload")
	}
	if int64(len(request.Data)) > spec.TotalSize {
		return "", nil, status.Errorf(codes.InvalidArgument, "data exceeds total_size")
	}
	setting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return "", nil, status.Errorf(codes.Internal, "failed to get storage setting: %v", err)
	}
	if err := checkUploadSize(setting, spec.TotalSize); err != nil {
		return "", nil, err
	}
	// Validate before allocating a temporary file. Keep the original MIME type
	// so an omitted type can be sniffed from real bytes at finalization.
	metadata := proto.CloneOf(spec.Attachment)
	validationMetadata := proto.CloneOf(metadata)
	if validationMetadata.Type == "" {
		// Type-dependent metadata validation must wait for content sniffing.
		validationMetadata.MediaMetadata = nil
	}
	create, err := s.prepareAttachment(ctx, &v1pb.CreateAttachmentRequest{Attachment: validationMetadata, AttachmentId: spec.AttachmentId})
	if err != nil {
		return "", nil, err
	}
	state := attachmentUploadState{metadata: metadata, uid: create.UID}
	return s.attachmentUploads.create(s.Profile.Data, attachmentUploadTempPrefix, ownerID, spec.TotalSize, state)
}

func (s *APIV1Service) finishAttachmentUpload(ctx context.Context, upload *attachmentUpload) (*v1pb.Attachment, error) {
	if upload.state.finalizeAttempted {
		// A database operation may commit before returning an error. Resolve that
		// outcome before saving another object under the upload's stable UID.
		persisted, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &upload.state.uid})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to resolve previous finalization: %v", err)
		}
		if persisted != nil {
			if persisted.CreatorID != upload.ownerID {
				return nil, status.Errorf(codes.AlreadyExists, "attachment ID already exists")
			}
			return s.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: "attachments/" + upload.state.uid})
		}
	}
	setting, err := s.Store.GetInstanceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get storage setting: %v", err)
	}
	if err := checkUploadSize(setting, upload.totalSize); err != nil {
		return nil, err
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
	// Revalidate memo permissions and media metadata with the actual MIME type.
	create, err := s.prepareAttachment(ctx, &v1pb.CreateAttachmentRequest{Attachment: metadata, AttachmentId: upload.state.uid})
	if err != nil {
		return nil, err
	}
	create.Size = upload.totalSize
	upload.state.finalizeAttempted = true
	return s.processAndSaveAttachment(ctx, create, setting, file)
}

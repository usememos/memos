package v1

import (
	"context"
	"crypto/sha256"
	"io"
	"os"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// UploadAttachment accepts bounded unary chunks. A call carrying a spec opens
// a new upload; a call carrying an upload ID continues one. Either kind may
// write data and finalize.
func (s *APIV1Service) UploadAttachment(ctx context.Context, request *v1pb.UploadAttachmentRequest) (*v1pb.UploadAttachmentResponse, error) {
	user, err := s.requireCurrentSpaceUser(ctx)
	if err != nil {
		return nil, err
	}
	if len(request.Data) > attachmentUploadChunkSize {
		return nil, status.Errorf(codes.ResourceExhausted, "upload chunk exceeds the limit")
	}
	var id string
	var upload *attachmentUpload
	switch u := request.Upload.(type) {
	case *v1pb.UploadAttachmentRequest_Spec:
		id, upload, err = s.startAttachmentUpload(ctx, request, u.Spec, user.ID)
		if err != nil {
			return nil, err
		}
		upload.mu.Lock()
	case *v1pb.UploadAttachmentRequest_UploadId:
		id = u.UploadId
		upload, err = s.attachmentUploads.get(id, user.ID)
		if err != nil {
			return nil, err
		}
		upload.mu.Lock()
		if !time.Now().Before(upload.expireTime) {
			upload.mu.Unlock()
			return nil, status.Errorf(codes.NotFound, "upload not found or expired")
		}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "spec or upload_id is required")
	}
	defer upload.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	if err := upload.write(ctx, request); err != nil {
		return nil, err
	}
	var attachment *v1pb.Attachment
	if upload.complete {
		// Recheck access and existence; a completed upload must not resurrect a
		// deleted attachment or disclose metadata after access is revoked.
		attachment, err = s.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: "attachments/" + upload.uid})
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
	upload.expireTime = time.Now().Add(attachmentUploadTTL)
	return &v1pb.UploadAttachmentResponse{
		UploadId: id, CommittedSize: upload.committedSize, Attachment: attachment, MaxChunkSize: attachmentUploadChunkSize,
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
	upload := &attachmentUpload{ownerID: ownerID, metadata: metadata, uid: create.UID, totalSize: spec.TotalSize}
	id, err := s.attachmentUploads.create(s.Profile.Data, upload)
	if err != nil {
		return "", nil, err
	}
	return id, upload, nil
}

func (u *attachmentUpload) write(ctx context.Context, request *v1pb.UploadAttachmentRequest) error {
	if len(request.Data) == 0 {
		if request.FinishWrite && request.WriteOffset != u.committedSize {
			return status.Errorf(codes.OutOfRange, "write_offset must equal committed_size")
		}
		return nil
	}
	digest := sha256.Sum256(request.Data)
	if u.committedSize > 0 && request.WriteOffset+int64(len(request.Data)) == u.committedSize && digest == u.lastDigest {
		return nil // A lost response can be retried without appending bytes twice.
	}
	if u.complete {
		return status.Errorf(codes.FailedPrecondition, "upload is already complete")
	}
	if request.WriteOffset != u.committedSize {
		return status.Errorf(codes.OutOfRange, "write_offset must equal committed_size")
	}
	if int64(len(request.Data)) > u.totalSize-u.committedSize {
		return status.Errorf(codes.InvalidArgument, "data exceeds total_size")
	}
	file, err := os.OpenFile(u.path, os.O_WRONLY, 0600)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open upload file: %v", err)
	}
	defer file.Close()
	n, err := file.WriteAt(request.Data, u.committedSize)
	if err == nil && n != len(request.Data) {
		err = io.ErrShortWrite
	}
	if err == nil {
		err = ctx.Err()
	}
	if err != nil {
		if truncateErr := file.Truncate(u.committedSize); truncateErr != nil {
			// The file no longer matches committedSize; revoke the upload.
			u.expireTime = time.Time{}
			os.Remove(u.path)
		}
		return status.Errorf(codes.Internal, "failed to write upload chunk: %v", err)
	}
	u.lastDigest = digest
	u.committedSize += int64(n)
	return nil
}

func (s *APIV1Service) finishAttachmentUpload(ctx context.Context, upload *attachmentUpload) (*v1pb.Attachment, error) {
	if upload.finalizeAttempted {
		// A database operation may commit before returning an error. Resolve that
		// outcome before saving another object under the upload's stable UID.
		persisted, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &upload.uid})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to resolve previous finalization: %v", err)
		}
		if persisted != nil {
			if persisted.CreatorID != upload.ownerID {
				return nil, status.Errorf(codes.AlreadyExists, "attachment ID already exists")
			}
			return s.GetAttachment(ctx, &v1pb.GetAttachmentRequest{Name: "attachments/" + upload.uid})
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
	metadata := proto.CloneOf(upload.metadata)
	metadata.Content = make([]byte, min(upload.totalSize, 512))
	if _, err := io.ReadFull(file, metadata.Content); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to read attachment header: %v", err)
	}
	// Revalidate memo permissions and media metadata with the actual MIME type.
	create, err := s.prepareAttachment(ctx, &v1pb.CreateAttachmentRequest{Attachment: metadata, AttachmentId: upload.uid})
	if err != nil {
		return nil, err
	}
	create.Size = upload.totalSize
	upload.finalizeAttempted = true
	return s.processAndSaveAttachment(ctx, create, setting, file)
}

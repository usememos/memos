package v1

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"time"

	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/core/memoarchive"
	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	importMemosProcedure = "/memos.api.v1.UserService/ImportMemos"
	memoImportTempPrefix = ".memos-rpc-import-"
	// maxMemoImportBytes caps one staged archive.
	maxMemoImportBytes = 4 << 30
)

// memoImportState is what a staged archive carries besides its bytes: the
// report, once the finishing call has imported it.
type memoImportState struct {
	report *v1pb.MemoImportReport
}

type memoImports = uploadSessions[memoImportState]

// resolveArchiveOwner resolves users/{user} and asserts it is the caller.
func (s *APIV1Service) resolveArchiveOwner(ctx context.Context, name string) (*store.User, error) {
	user, err := ResolveUserByName(ctx, s.Store, name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.requireCallerIs(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

// ExportMemos writes the caller's Memo Archive into the response body.
func (s *APIV1Service) ExportMemos(ctx context.Context, request *v1pb.ExportMemosRequest) (*httpbody.HttpBody, error) {
	user, err := s.resolveArchiveOwner(ctx, request.Name)
	if err != nil {
		return nil, err
	}
	if err := s.throttleAndCharge(ratelimit.ScopeArchiveUser, userKey(user.ID), 1); err != nil {
		return nil, err
	}
	var archive bytes.Buffer
	if err := s.ExportMemoArchive(ctx, user, &archive); err != nil {
		slog.Error("memo archive export failed", slog.Int("user", int(user.ID)), slog.Any("error", err))
		return nil, status.Error(codes.Internal, "failed to export memos")
	}
	return &httpbody.HttpBody{ContentType: memoarchive.MediaType, Data: archive.Bytes()}, nil
}

// ImportMemos stages an archive in chunks and, on the finishing call, plans
// or imports it. See the proto comment for the protocol.
func (s *APIV1Service) ImportMemos(ctx context.Context, request *v1pb.ImportMemosRequest) (*v1pb.ImportMemosResponse, error) {
	user, err := s.resolveArchiveOwner(ctx, request.Name)
	if err != nil {
		return nil, err
	}
	if len(request.Data) > uploadChunkSize {
		return nil, status.Errorf(codes.ResourceExhausted, "upload chunk exceeds the limit")
	}
	var id string
	var upload *uploadSession[memoImportState]
	switch u := request.Upload.(type) {
	case *v1pb.ImportMemosRequest_Spec:
		if err := s.throttleAndCharge(ratelimit.ScopeArchiveUser, userKey(user.ID), 1); err != nil {
			return nil, err
		}
		if u.Spec.TotalSize < 0 || u.Spec.TotalSize > maxMemoImportBytes {
			return nil, status.Errorf(codes.InvalidArgument, "invalid total_size")
		}
		if request.WriteOffset != 0 {
			return nil, status.Errorf(codes.OutOfRange, "write_offset must be 0 for a new upload")
		}
		if int64(len(request.Data)) > u.Spec.TotalSize {
			return nil, status.Errorf(codes.InvalidArgument, "data exceeds total_size")
		}
		id, upload, err = s.memoImports.create(s.Profile.Data, memoImportTempPrefix, user.ID, u.Spec.TotalSize, memoImportState{})
		if err != nil {
			return nil, err
		}
		upload.mu.Lock()
	case *v1pb.ImportMemosRequest_UploadId:
		id = u.UploadId
		upload, err = s.memoImports.resume(id, user.ID)
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
	response := &v1pb.ImportMemosResponse{UploadId: id, CommittedSize: upload.committedSize, MaxChunkSize: uploadChunkSize}
	if upload.complete {
		response.Result = &v1pb.ImportMemosResponse_Report{Report: upload.state.report}
	} else if request.FinishWrite {
		if upload.committedSize != upload.totalSize {
			return nil, status.Errorf(codes.FailedPrecondition, "upload is incomplete")
		}
		if err := s.finishMemoImport(ctx, user, upload, request, response); err != nil {
			return nil, err
		}
	}
	upload.expireTime = time.Now().Add(uploadTTL)
	return response, nil
}

// finishMemoImport reads the staged archive and either plans or imports it,
// setting the response result. An import completes the session; a plan
// leaves it staged.
func (s *APIV1Service) finishMemoImport(ctx context.Context, user *store.User, upload *uploadSession[memoImportState], request *v1pb.ImportMemosRequest, response *v1pb.ImportMemosResponse) error {
	file, err := os.Open(upload.path)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to open upload file: %v", err)
	}
	defer file.Close()
	archive, err := memoarchive.Read(file, upload.totalSize)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid memo archive: %v", err)
	}
	if request.ValidateOnly {
		// A plan can be requested again and again on the same staged archive,
		// each time re-parsing it in full, so it costs an archive unit too.
		if err := s.throttleAndCharge(ratelimit.ScopeArchiveUser, userKey(user.ID), 1); err != nil {
			return err
		}
		plan, err := s.PlanMemoArchiveImport(ctx, user, archive)
		if err != nil {
			slog.Error("memo archive plan failed", slog.Int("user", int(user.ID)), slog.Any("error", err))
			return status.Error(codes.Internal, "failed to inspect the archive")
		}
		response.Result = &v1pb.ImportMemosResponse_Plan{Plan: plan}
		return nil
	}
	report, err := s.ImportMemoArchive(ctx, user, archive, request.ConflictPolicy)
	if err != nil {
		slog.Error("memo archive import failed", slog.Int("user", int(user.ID)), slog.Any("error", err))
		return status.Error(codes.Internal, "failed to import memos")
	}
	upload.state.report = report
	upload.complete = true
	os.Remove(upload.path)
	response.Result = &v1pb.ImportMemosResponse_Report{Report: report}
	return nil
}

package api

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/core/usagelimit"
	"github.com/usememos/memos/store"
)

// checkMemoQuota refuses a new memo when the user has reached the memo limit.
func (s *APIService) checkMemoQuota(ctx context.Context, userID int32) error {
	return s.quotaError(ctx, userID, usagelimit.CheckMemoCreate(ctx, s.Store, userID))
}

// checkMemoContentQuota refuses content larger than the memo owner's limit.
func (s *APIService) checkMemoContentQuota(ctx context.Context, userID int32, content string) error {
	return s.quotaError(ctx, userID, usagelimit.CheckMemoContentSize(ctx, s.Store, userID, int64(len(content))))
}

// checkUploadQuota refuses an upload of size bytes that would break the
// per-file or storage limit of the user.
func (s *APIService) checkUploadQuota(ctx context.Context, userID int32, size int64) error {
	return s.quotaError(ctx, userID, usagelimit.CheckUpload(ctx, s.Store, userID, size))
}

// checkFileSizeQuota refuses a file of size bytes that is larger than the
// per-file limit of the user. It runs no count or sum query.
func (s *APIService) checkFileSizeQuota(ctx context.Context, userID int32, size int64) error {
	return s.quotaError(ctx, userID, usagelimit.CheckFileSize(ctx, s.Store, userID, size))
}

// quotaError maps a usage limit check result to a service error, naming the
// user in a refusal. A failed check refuses the request: failing open would
// let a database problem switch the limits off.
func (s *APIService) quotaError(ctx context.Context, userID int32, err error) error {
	if err == nil {
		return nil
	}
	refusal := usagelimit.AsRefusal(err)
	if refusal == nil {
		return status.Errorf(codes.Internal, "failed to check usage limits: %v", err)
	}
	username := ""
	if user, userErr := s.Store.GetUser(ctx, &store.FindUser{ID: &userID}); userErr == nil && user != nil {
		username = user.Username
	}
	return newQuotaExceededError(username, refusal)
}

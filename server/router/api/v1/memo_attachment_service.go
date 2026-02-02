package v1

import (
	"context"
	"slices"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) SetMemoAttachments(ctx context.Context, request *v1pb.SetMemoAttachmentsRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	// Delete attachments that are not in the request.
	for _, attachment := range attachments {
		found := false
		for _, requestAttachment := range request.Attachments {
			requestAttachmentUID, err := ExtractAttachmentUIDFromName(requestAttachment.Name)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid attachment name: %v", err)
			}
			if attachment.UID == requestAttachmentUID {
				found = true
				break
			}
		}
		if !found {
			if err = s.Store.DeleteAttachment(ctx, &store.DeleteAttachment{
				ID:     int32(attachment.ID),
				MemoID: &memo.ID,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to delete attachment")
			}
		}
	}

	slices.Reverse(request.Attachments)
	// Update attachments' memo_id in the request.
	for index, attachment := range request.Attachments {
		attachmentUID, err := ExtractAttachmentUIDFromName(attachment.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid attachment name: %v", err)
		}
		tempAttachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
		}
		updatedTs := time.Now().Unix() + int64(index)
		if err := s.Store.UpdateAttachment(ctx, &store.UpdateAttachment{
			ID:        tempAttachment.ID,
			MemoID:    &memo.ID,
			UpdatedTs: &updatedTs,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update attachment: %v", err)
		}
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListMemoAttachments(ctx context.Context, request *v1pb.ListMemoAttachmentsRequest) (*v1pb.ListMemoAttachmentsResponse, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	// Check memo visibility.
	if memo.Visibility != store.Public {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		if memo.Visibility == store.Private && memo.CreatorID != user.ID && !isSuperUser(user) {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments: %v", err)
	}

	response := &v1pb.ListMemoAttachmentsResponse{
		Attachments: []*v1pb.Attachment{},
	}
	for _, attachment := range attachments {
		response.Attachments = append(response.Attachments, convertAttachmentFromStore(attachment))
	}
	return response, nil
}

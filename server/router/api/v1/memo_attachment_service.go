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
	if !canModifyMemo(user, memo) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if err := s.setMemoAttachmentsInternal(ctx, memo, request.Attachments); err != nil {
		return nil, err
	}
	if err := s.touchMemoUpdatedTimestamp(ctx, memo.ID); err != nil {
		return nil, err
	}
	updatedMemo, parentMemo, memoMessage, err := s.buildUpdatedMemoState(ctx, memo.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to build updated memo state")
	}
	s.dispatchMemoUpdatedSideEffects(ctx, updatedMemo, parentMemo, memoMessage)

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) setMemoAttachmentsInternal(ctx context.Context, memo *store.Memo, requestAttachments []*v1pb.Attachment) error {
	currentAttachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to list attachments")
	}

	normalizedAttachments, err := s.normalizeMemoAttachmentRequest(ctx, currentAttachments, requestAttachments)
	if err != nil {
		return err
	}

	requestedIDs := make(map[int32]bool, len(normalizedAttachments))
	for _, attachment := range normalizedAttachments {
		requestedIDs[attachment.ID] = true
	}

	// Delete attachments that are not in the request.
	for _, attachment := range currentAttachments {
		if !requestedIDs[attachment.ID] {
			if err = s.Store.DeleteAttachment(ctx, &store.DeleteAttachment{
				ID:     int32(attachment.ID),
				MemoID: &memo.ID,
			}); err != nil {
				return status.Errorf(codes.Internal, "failed to delete attachment")
			}
		}
	}

	slices.Reverse(normalizedAttachments)
	// Update attachments' memo_id in the request.
	for index, attachment := range normalizedAttachments {
		updatedTs := time.Now().Unix() + int64(index)
		if err := s.Store.UpdateAttachment(ctx, &store.UpdateAttachment{
			ID:        attachment.ID,
			MemoID:    &memo.ID,
			UpdatedTs: &updatedTs,
		}); err != nil {
			return status.Errorf(codes.Internal, "failed to update attachment: %v", err)
		}
	}

	return nil
}

func (s *APIV1Service) normalizeMemoAttachmentRequest(
	ctx context.Context,
	currentAttachments []*store.Attachment,
	requestAttachments []*v1pb.Attachment,
) ([]*store.Attachment, error) {
	requestedAttachments := make([]*store.Attachment, 0, len(requestAttachments))
	for _, requestAttachment := range requestAttachments {
		attachmentUID, err := ExtractAttachmentUIDFromName(requestAttachment.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid attachment name: %v", err)
		}
		attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &attachmentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get attachment: %v", err)
		}
		if attachment == nil {
			return nil, status.Errorf(codes.NotFound, "attachment not found: %s", attachmentUID)
		}
		requestedAttachments = append(requestedAttachments, attachment)
	}

	currentGroups := make(map[string][]*store.Attachment)
	for _, attachment := range currentAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			continue
		}
		currentGroups[motion.GroupId] = append(currentGroups[motion.GroupId], attachment)
	}

	requestGroups := make(map[string][]*store.Attachment)
	requestNamesByGroup := make(map[string]map[string]bool)
	for _, attachment := range requestedAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			continue
		}
		requestGroups[motion.GroupId] = append(requestGroups[motion.GroupId], attachment)
		if requestNamesByGroup[motion.GroupId] == nil {
			requestNamesByGroup[motion.GroupId] = make(map[string]bool)
		}
		requestNamesByGroup[motion.GroupId][attachment.UID] = true
	}

	normalized := make([]*store.Attachment, 0, len(requestedAttachments))
	appendedGroups := make(map[string]bool)
	appendedAttachments := make(map[string]bool)
	for _, attachment := range requestedAttachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			if !appendedAttachments[attachment.UID] {
				normalized = append(normalized, attachment)
				appendedAttachments[attachment.UID] = true
			}
			continue
		}

		groupID := motion.GroupId
		if appendedGroups[groupID] {
			continue
		}

		currentGroup := currentGroups[groupID]
		if isMultiMemberMotionGroup(currentGroup) && !allGroupMembersRequested(currentGroup, requestNamesByGroup[groupID]) {
			appendedGroups[groupID] = true
			continue
		}

		for _, groupAttachment := range requestGroups[groupID] {
			if appendedAttachments[groupAttachment.UID] {
				continue
			}
			normalized = append(normalized, groupAttachment)
			appendedAttachments[groupAttachment.UID] = true
		}
		appendedGroups[groupID] = true
	}

	return normalized, nil
}

func allGroupMembersRequested(group []*store.Attachment, requestedNames map[string]bool) bool {
	if len(group) == 0 {
		return false
	}

	for _, attachment := range group {
		if !requestedNames[attachment.UID] {
			return false
		}
	}
	return true
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

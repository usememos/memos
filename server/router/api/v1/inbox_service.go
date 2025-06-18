package v1

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListInboxes(ctx context.Context, request *v1pb.ListInboxesRequest) (*v1pb.ListInboxesResponse, error) {
	// Extract user ID from parent resource name
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent name %q: %v", request.Parent, err)
	}

	// Get current user for authorization
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Check if current user can access the requested user's inboxes
	if currentUser.ID != userID {
		// Only allow hosts and admins to access other users' inboxes
		if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
			return nil, status.Errorf(codes.PermissionDenied, "cannot access inboxes for user %q", request.Parent)
		}
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	limitPlusOne := limit + 1

	findInbox := &store.FindInbox{
		ReceiverID: &userID,
		Limit:      &limitPlusOne,
		Offset:     &offset,
	}

	inboxes, err := s.Store.ListInboxes(ctx, findInbox)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inboxes: %v", err)
	}

	inboxMessages := []*v1pb.Inbox{}
	nextPageToken := ""
	if len(inboxes) == limitPlusOne {
		inboxes = inboxes[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token: %v", err)
		}
	}
	for _, inbox := range inboxes {
		inboxMessage := convertInboxFromStore(inbox)
		if inboxMessage.Type == v1pb.Inbox_TYPE_UNSPECIFIED {
			continue
		}
		inboxMessages = append(inboxMessages, inboxMessage)
	}

	response := &v1pb.ListInboxesResponse{
		Inboxes:       inboxMessages,
		NextPageToken: nextPageToken,
		TotalSize:     int32(len(inboxMessages)), // For now, use actual returned count
	}
	return response, nil
}

func (s *APIV1Service) UpdateInbox(ctx context.Context, request *v1pb.UpdateInboxRequest) (*v1pb.Inbox, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	inboxID, err := ExtractInboxIDFromName(request.Inbox.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name %q: %v", request.Inbox.Name, err)
	}

	// Get current user for authorization
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Get the existing inbox to verify ownership
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &inboxID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "inbox %q not found", request.Inbox.Name)
	}
	existingInbox := inboxes[0]

	// Check if current user can update this inbox (must be the receiver)
	if currentUser.ID != existingInbox.ReceiverID {
		return nil, status.Errorf(codes.PermissionDenied, "cannot update inbox for another user")
	}

	update := &store.UpdateInbox{
		ID: inboxID,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "status" {
			if request.Inbox.Status == v1pb.Inbox_STATUS_UNSPECIFIED {
				return nil, status.Errorf(codes.InvalidArgument, "status cannot be unspecified")
			}
			update.Status = convertInboxStatusToStore(request.Inbox.Status)
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "unsupported field in update mask: %q", field)
		}
	}

	inbox, err := s.Store.UpdateInbox(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
	}

	return convertInboxFromStore(inbox), nil
}

func (s *APIV1Service) DeleteInbox(ctx context.Context, request *v1pb.DeleteInboxRequest) (*emptypb.Empty, error) {
	inboxID, err := ExtractInboxIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name %q: %v", request.Name, err)
	}

	// Get current user for authorization
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Get the existing inbox to verify ownership
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &inboxID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "inbox %q not found", request.Name)
	}
	existingInbox := inboxes[0]

	// Check if current user can delete this inbox (must be the receiver)
	if currentUser.ID != existingInbox.ReceiverID {
		return nil, status.Errorf(codes.PermissionDenied, "cannot delete inbox for another user")
	}

	if err := s.Store.DeleteInbox(ctx, &store.DeleteInbox{
		ID: inboxID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete inbox: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func convertInboxFromStore(inbox *store.Inbox) *v1pb.Inbox {
	return &v1pb.Inbox{
		Name:       fmt.Sprintf("%s%d", InboxNamePrefix, inbox.ID),
		Sender:     fmt.Sprintf("%s%d", UserNamePrefix, inbox.SenderID),
		Receiver:   fmt.Sprintf("%s%d", UserNamePrefix, inbox.ReceiverID),
		Status:     convertInboxStatusFromStore(inbox.Status),
		CreateTime: timestamppb.New(time.Unix(inbox.CreatedTs, 0)),
		Type:       v1pb.Inbox_Type(inbox.Message.Type),
		ActivityId: inbox.Message.ActivityId,
	}
}

func convertInboxStatusFromStore(status store.InboxStatus) v1pb.Inbox_Status {
	switch status {
	case store.UNREAD:
		return v1pb.Inbox_UNREAD
	case store.ARCHIVED:
		return v1pb.Inbox_ARCHIVED
	default:
		return v1pb.Inbox_STATUS_UNSPECIFIED
	}
}

func convertInboxStatusToStore(status v1pb.Inbox_Status) store.InboxStatus {
	switch status {
	case v1pb.Inbox_UNREAD:
		return store.UNREAD
	case v1pb.Inbox_ARCHIVED:
		return store.ARCHIVED
	default:
		return store.UNREAD
	}
}

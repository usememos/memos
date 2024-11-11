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
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
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
	limitPlusOne := limit + 1

	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
		Limit:      &limitPlusOne,
		Offset:     &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inbox: %v", err)
	}

	inboxMessages := []*v1pb.Inbox{}
	nextPageToken := ""
	if len(inboxes) == limitPlusOne {
		inboxes = inboxes[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
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
	}
	return response, nil
}

func (s *APIV1Service) UpdateInbox(ctx context.Context, request *v1pb.UpdateInboxRequest) (*v1pb.Inbox, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	inboxID, err := ExtractInboxIDFromName(request.Inbox.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name: %v", err)
	}
	update := &store.UpdateInbox{
		ID: inboxID,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "status" {
			if request.Inbox.Status == v1pb.Inbox_STATUS_UNSPECIFIED {
				return nil, status.Errorf(codes.InvalidArgument, "status is required")
			}
			update.Status = convertInboxStatusToStore(request.Inbox.Status)
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
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name: %v", err)
	}

	if err := s.Store.DeleteInbox(ctx, &store.DeleteInbox{
		ID: inboxID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
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

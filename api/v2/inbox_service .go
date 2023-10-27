package v2

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) ListInbox(ctx context.Context, _ *apiv2pb.ListInboxRequest) (*apiv2pb.ListInboxResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	inboxList, err := s.Store.ListInbox(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inbox: %v", err)
	}

	response := &apiv2pb.ListInboxResponse{
		Inbox: []*apiv2pb.Inbox{},
	}
	for _, inbox := range inboxList {
		inboxMessage, err := s.convertInboxFromStore(ctx, inbox)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert inbox from store: %v", err)
		}
		response.Inbox = append(response.Inbox, inboxMessage)
	}

	return response, nil
}

func (s *APIV2Service) UpdateInbox(ctx context.Context, request *apiv2pb.UpdateInboxRequest) (*apiv2pb.UpdateInboxResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	inboxID, err := GetInboxID(request.Inbox.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name: %v", err)
	}
	update := &store.UpdateInbox{
		ID: inboxID,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "status" {
			if request.Inbox.Status == apiv2pb.Inbox_STATUS_UNSPECIFIED {
				return nil, status.Errorf(codes.InvalidArgument, "status is required")
			}
			update.Status = convertInboxStatusToStore(request.Inbox.Status)
		}
	}

	inbox, err := s.Store.UpdateInbox(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
	}

	inboxMessage, err := s.convertInboxFromStore(ctx, inbox)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert inbox from store: %v", err)
	}
	return &apiv2pb.UpdateInboxResponse{
		Inbox: inboxMessage,
	}, nil
}

func (s *APIV2Service) DeleteInbox(ctx context.Context, request *apiv2pb.DeleteInboxRequest) (*apiv2pb.DeleteInboxResponse, error) {
	inboxID, err := GetInboxID(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid inbox name: %v", err)
	}

	if err := s.Store.DeleteInbox(ctx, &store.DeleteInbox{
		ID: inboxID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
	}
	return &apiv2pb.DeleteInboxResponse{}, nil
}

func (*APIV2Service) convertInboxFromStore(_ context.Context, inbox *store.Inbox) (*apiv2pb.Inbox, error) {
	// TODO: convert sender and receiver.
	return &apiv2pb.Inbox{
		Name:    fmt.Sprintf("inbox/%d", inbox.ID),
		Status:  convertInboxStatusFromStore(inbox.Status),
		Title:   inbox.Message.Title,
		Content: inbox.Message.Content,
		Link:    inbox.Message.Link,
	}, nil
}

func convertInboxStatusFromStore(status store.InboxStatus) apiv2pb.Inbox_Status {
	switch status {
	case store.UNREAD:
		return apiv2pb.Inbox_UNREAD
	case store.READ:
		return apiv2pb.Inbox_READ
	case store.ARCHIVED:
		return apiv2pb.Inbox_ARCHIVED
	default:
		return apiv2pb.Inbox_STATUS_UNSPECIFIED
	}
}

func convertInboxStatusToStore(status apiv2pb.Inbox_Status) store.InboxStatus {
	switch status {
	case apiv2pb.Inbox_UNREAD:
		return store.UNREAD
	case apiv2pb.Inbox_READ:
		return store.READ
	case apiv2pb.Inbox_ARCHIVED:
		return store.ARCHIVED
	default:
		return store.UNREAD
	}
}

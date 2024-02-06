package v2

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) ListInboxes(ctx context.Context, _ *apiv2pb.ListInboxesRequest) (*apiv2pb.ListInboxesResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inbox: %v", err)
	}

	response := &apiv2pb.ListInboxesResponse{
		Inboxes: []*apiv2pb.Inbox{},
	}
	for _, inbox := range inboxes {
		inboxMessage, err := s.convertInboxFromStore(ctx, inbox)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert inbox from store: %v", err)
		}
		response.Inboxes = append(response.Inboxes, inboxMessage)
	}

	return response, nil
}

func (s *APIV2Service) UpdateInbox(ctx context.Context, request *apiv2pb.UpdateInboxRequest) (*apiv2pb.UpdateInboxResponse, error) {
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
	inboxID, err := ExtractInboxIDFromName(request.Name)
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

func (s *APIV2Service) convertInboxFromStore(ctx context.Context, inbox *store.Inbox) (*apiv2pb.Inbox, error) {
	sender, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &inbox.SenderID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get sender")
	}
	receiver, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &inbox.ReceiverID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get receiver")
	}

	return &apiv2pb.Inbox{
		Name:       fmt.Sprintf("inboxes/%d", inbox.ID),
		Sender:     fmt.Sprintf("users/%s", sender.Username),
		Receiver:   fmt.Sprintf("users/%s", receiver.Username),
		Status:     convertInboxStatusFromStore(inbox.Status),
		CreateTime: timestamppb.New(time.Unix(inbox.CreatedTs, 0)),
		Type:       apiv2pb.Inbox_Type(inbox.Message.Type),
		ActivityId: inbox.Message.ActivityId,
	}, nil
}

func convertInboxStatusFromStore(status store.InboxStatus) apiv2pb.Inbox_Status {
	switch status {
	case store.UNREAD:
		return apiv2pb.Inbox_UNREAD
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
	case apiv2pb.Inbox_ARCHIVED:
		return store.ARCHIVED
	default:
		return store.UNREAD
	}
}

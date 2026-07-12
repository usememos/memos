package v1

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListUserNotifications(ctx context.Context, request *v1pb.ListUserNotificationsRequest) (*v1pb.ListUserNotificationsResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	userID := user.ID

	// Verify the requesting user has permission to view these notifications
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Fetch inbox items from storage.
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inboxes: %v", err)
	}

	// Convert storage layer inboxes to API notifications.
	userIDs := make([]int32, 0, len(inboxes)*2)
	for _, inbox := range inboxes {
		userIDs = append(userIDs, inbox.ReceiverID, inbox.SenderID)
	}
	usersByID, err := s.listUsersByID(ctx, userIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list notification users: %v", err)
	}
	memosByID, err := s.listMemosByID(ctx, collectInboxMemoIDs(inboxes))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list notification memos: %v", err)
	}

	notifications := []*v1pb.UserNotification{}
	for _, inbox := range inboxes {
		notification, err := s.convertInboxToUserNotificationWithUsersAndMemos(inbox, currentUser, usersByID, memosByID)
		if err != nil {
			if status.Code(err) == codes.NotFound {
				slog.Warn("Skipping notification with missing user",
					slog.Int64("notification_id", int64(inbox.ID)),
					slog.Int64("receiver_id", int64(inbox.ReceiverID)),
					slog.Int64("sender_id", int64(inbox.SenderID)),
				)
				continue
			}
			return nil, status.Errorf(codes.Internal, "failed to convert inbox: %v", err)
		}
		if notification.Type == v1pb.UserNotification_TYPE_UNSPECIFIED {
			continue
		}
		notifications = append(notifications, notification)
	}

	return &v1pb.ListUserNotificationsResponse{
		Notifications: notifications,
	}, nil
}

// UpdateUserNotification updates a notification's status (e.g., marking as read/archived).
// Only the notification owner can update their notifications.
func (s *APIV1Service) UpdateUserNotification(ctx context.Context, request *v1pb.UpdateUserNotificationRequest) (*v1pb.UserNotification, error) {
	if request.Notification == nil {
		return nil, status.Errorf(codes.InvalidArgument, "notification is required")
	}

	user, notificationID, err := s.resolveUserAndNotificationIDFromName(ctx, request.Notification.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid notification name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	// Verify ownership before updating
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &notificationID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "notification not found")
	}
	inbox := inboxes[0]
	if inbox.ReceiverID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Build update request based on field mask
	update := &store.UpdateInbox{
		ID: notificationID,
	}

	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "status":
			// Convert API status enum to storage enum
			var inboxStatus store.InboxStatus
			switch request.Notification.Status {
			case v1pb.UserNotification_UNREAD:
				inboxStatus = store.UNREAD
			case v1pb.UserNotification_ARCHIVED:
				inboxStatus = store.ARCHIVED
			default:
				return nil, status.Errorf(codes.InvalidArgument, "invalid status")
			}
			update.Status = inboxStatus
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}

	updatedInbox, err := s.Store.UpdateInbox(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
	}

	notification, err := s.convertInboxToUserNotification(ctx, updatedInbox, currentUser)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert inbox: %v", err)
	}

	return notification, nil
}

// DeleteUserNotification permanently deletes a notification.
// Only the notification owner can delete their notifications.
func (s *APIV1Service) DeleteUserNotification(ctx context.Context, request *v1pb.DeleteUserNotificationRequest) (*emptypb.Empty, error) {
	user, notificationID, err := s.resolveUserAndNotificationIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid notification name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	// Verify ownership before deletion
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &notificationID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "notification not found")
	}
	inbox := inboxes[0]
	if inbox.ReceiverID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteInbox(ctx, &store.DeleteInbox{
		ID: notificationID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete inbox: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// convertInboxToUserNotification converts a storage-layer inbox to an API notification.
// This handles the mapping between the internal inbox representation and the public API.
func (s *APIV1Service) convertInboxToUserNotification(ctx context.Context, inbox *store.Inbox, viewer *store.User) (*v1pb.UserNotification, error) {
	usersByID, err := s.listUsersByID(ctx, []int32{inbox.ReceiverID, inbox.SenderID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list notification users: %v", err)
	}
	memosByID, err := s.listMemosByID(ctx, collectInboxMemoIDs([]*store.Inbox{inbox}))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list notification memos: %v", err)
	}
	return s.convertInboxToUserNotificationWithUsersAndMemos(inbox, viewer, usersByID, memosByID)
}

func collectInboxMemoIDs(inboxes []*store.Inbox) []int32 {
	memoIDs := make([]int32, 0, len(inboxes)*2)
	for _, inbox := range inboxes {
		if inbox == nil || inbox.Message == nil {
			continue
		}
		switch inbox.Message.Type {
		case storepb.InboxMessage_MEMO_COMMENT:
			payload := inbox.Message.GetMemoComment()
			if payload != nil {
				memoIDs = append(memoIDs, payload.MemoId, payload.RelatedMemoId)
			}
		case storepb.InboxMessage_MEMO_MENTION:
			payload := inbox.Message.GetMemoMention()
			if payload != nil {
				memoIDs = append(memoIDs, payload.MemoId, payload.RelatedMemoId)
			}
		default:
			// Ignore notification types without memo references.
		}
	}
	return memoIDs
}

func (s *APIV1Service) convertInboxToUserNotificationWithUsersAndMemos(inbox *store.Inbox, viewer *store.User, usersByID map[int32]*store.User, memosByID map[int32]*store.Memo) (*v1pb.UserNotification, error) {
	receiver := usersByID[inbox.ReceiverID]
	if receiver == nil {
		return nil, status.Errorf(codes.NotFound, "notification receiver not found")
	}
	sender := usersByID[inbox.SenderID]
	if sender == nil {
		return nil, status.Errorf(codes.NotFound, "notification sender not found")
	}

	notification := &v1pb.UserNotification{
		Name:       fmt.Sprintf("%s/notifications/%d", BuildUserName(receiver.Username), inbox.ID),
		Sender:     BuildUserName(sender.Username),
		SenderUser: convertUserFromStore(sender, viewer),
		CreateTime: timestamppb.New(time.Unix(inbox.CreatedTs, 0)),
	}

	// Convert status from storage enum to API enum
	switch inbox.Status {
	case store.UNREAD:
		notification.Status = v1pb.UserNotification_UNREAD
	case store.ARCHIVED:
		notification.Status = v1pb.UserNotification_ARCHIVED
	default:
		notification.Status = v1pb.UserNotification_STATUS_UNSPECIFIED
	}

	// Extract notification type and payload from the inbox message.
	if inbox.Message != nil {
		switch inbox.Message.Type {
		case storepb.InboxMessage_MEMO_COMMENT:
			notification.Type = v1pb.UserNotification_MEMO_COMMENT
			payload, err := s.convertMemoCommentNotificationPayload(viewer, inbox.Message, memosByID)
			if err != nil {
				return nil, err
			}
			if payload != nil {
				notification.Payload = &v1pb.UserNotification_MemoComment{
					MemoComment: payload,
				}
			}
		case storepb.InboxMessage_MEMO_MENTION:
			notification.Type = v1pb.UserNotification_MEMO_MENTION
			payload, err := s.convertMemoMentionNotificationPayload(viewer, inbox.Message, memosByID)
			if err != nil {
				return nil, err
			}
			if payload != nil {
				notification.Payload = &v1pb.UserNotification_MemoMention{
					MemoMention: payload,
				}
			}
		default:
			notification.Type = v1pb.UserNotification_TYPE_UNSPECIFIED
		}
	}

	return notification, nil
}

func canViewerAccessMemo(viewer *store.User, memo *store.Memo) bool {
	if memo == nil {
		return false
	}
	if viewer != nil && isSuperUser(viewer) {
		return true
	}
	if memo.Visibility == store.Private {
		return viewer != nil && viewer.ID == memo.CreatorID
	}
	if memo.Visibility == store.Protected {
		return viewer != nil
	}
	return true
}

func (s *APIV1Service) memoNotificationSnippet(memo *store.Memo) (string, error) {
	if memo == nil || memo.Content == "" {
		return "", nil
	}

	snippet, err := s.getMemoContentSnippet(memo.Content)
	if err != nil {
		return "", err
	}
	return snippet, nil
}

func (s *APIV1Service) convertMemoCommentNotificationPayload(viewer *store.User, message *storepb.InboxMessage, memosByID map[int32]*store.Memo) (*v1pb.UserNotification_MemoCommentPayload, error) {
	memoComment := message.GetMemoComment()
	if message == nil || message.Type != storepb.InboxMessage_MEMO_COMMENT || memoComment == nil {
		return nil, nil
	}

	commentMemo := memosByID[memoComment.MemoId]
	if !canViewerAccessMemo(viewer, commentMemo) {
		return nil, nil
	}

	relatedMemo := memosByID[memoComment.RelatedMemoId]
	if !canViewerAccessMemo(viewer, relatedMemo) {
		return nil, nil
	}

	memoSnippet, err := s.memoNotificationSnippet(commentMemo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get comment memo snippet")
	}
	relatedMemoSnippet, err := s.memoNotificationSnippet(relatedMemo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get related memo snippet")
	}

	return &v1pb.UserNotification_MemoCommentPayload{
		Memo:               fmt.Sprintf("%s%s", MemoNamePrefix, commentMemo.UID),
		RelatedMemo:        fmt.Sprintf("%s%s", MemoNamePrefix, relatedMemo.UID),
		MemoSnippet:        memoSnippet,
		RelatedMemoSnippet: relatedMemoSnippet,
	}, nil
}

func (s *APIV1Service) convertMemoMentionNotificationPayload(viewer *store.User, message *storepb.InboxMessage, memosByID map[int32]*store.Memo) (*v1pb.UserNotification_MemoMentionPayload, error) {
	memoMention := message.GetMemoMention()
	if message == nil || message.Type != storepb.InboxMessage_MEMO_MENTION || memoMention == nil {
		return nil, nil
	}

	memo := memosByID[memoMention.MemoId]
	if !canViewerAccessMemo(viewer, memo) {
		return nil, nil
	}

	memoSnippet, err := s.memoNotificationSnippet(memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get mention memo snippet")
	}

	payload := &v1pb.UserNotification_MemoMentionPayload{
		Memo:        fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID),
		MemoSnippet: memoSnippet,
	}
	if memoMention.RelatedMemoId != 0 {
		relatedMemo := memosByID[memoMention.RelatedMemoId]
		if canViewerAccessMemo(viewer, relatedMemo) {
			payload.RelatedMemo = fmt.Sprintf("%s%s", MemoNamePrefix, relatedMemo.UID)
			relatedMemoSnippet, err := s.memoNotificationSnippet(relatedMemo)
			if err != nil {
				return nil, errors.Wrap(err, "failed to get related memo snippet")
			}
			payload.RelatedMemoSnippet = relatedMemoSnippet
		}
	}

	return payload, nil
}

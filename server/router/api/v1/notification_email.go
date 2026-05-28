package v1

import (
	"context"
	"log/slog"

	"github.com/usememos/memos/server/notification"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) createInboxWithEmailNotification(ctx context.Context, inbox *store.Inbox) (*store.Inbox, error) {
	createdInbox, err := s.Store.CreateInbox(ctx, inbox)
	if err != nil {
		return nil, err
	}
	s.dispatchInboxEmailNotificationBestEffort(ctx, createdInbox)
	return createdInbox, nil
}

func (s *APIV1Service) dispatchInboxEmailNotificationBestEffort(ctx context.Context, inbox *store.Inbox) {
	dispatcher := notification.NewEmailDispatcher(s.Profile, s.Store, s.NotificationEmailSender)
	if err := dispatcher.DispatchInboxEmail(ctx, inbox); err != nil {
		slog.Warn("Failed to dispatch inbox email notification",
			slog.Any("err", err),
			slog.Int64("inbox_id", int64(inbox.ID)),
			slog.Int64("receiver_id", int64(inbox.ReceiverID)))
	}
}

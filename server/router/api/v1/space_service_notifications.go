package v1

import (
	"context"
	"log/slog"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// createSpaceInvitationNotification records the invitation in the invitee's
// inbox. The invitation itself is already persisted, so a failure here only
// loses the notification and is logged instead of failing the request.
func (s *APIV1Service) createSpaceInvitationNotification(ctx context.Context, space *store.Space, inviter *store.User, invitee *store.User) {
	if space == nil || inviter == nil || invitee == nil {
		return
	}
	if _, err := s.createInboxWithEmailNotification(ctx, &store.Inbox{
		SenderID:   inviter.ID,
		ReceiverID: invitee.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_SPACE_INVITATION,
			Payload: &storepb.InboxMessage_SpaceInvitation{
				SpaceInvitation: &storepb.InboxMessage_SpaceInvitationPayload{SpaceId: space.ID},
			},
		},
	}); err != nil {
		slog.Warn("Failed to create space invitation notification",
			slog.Any("err", err),
			slog.Int64("space_id", int64(space.ID)),
			slog.Int64("receiver_id", int64(invitee.ID)))
	}
}

// archiveSpaceInvitationNotifications marks the receiver's notifications for
// the space as handled once the invitation has been accepted.
func (s *APIV1Service) archiveSpaceInvitationNotifications(ctx context.Context, receiverID, spaceID int32) {
	s.forEachSpaceInvitationNotification(ctx, receiverID, spaceID, func(inbox *store.Inbox) error {
		if inbox.Status == store.ARCHIVED {
			return nil
		}
		_, err := s.Store.UpdateInbox(ctx, &store.UpdateInbox{ID: inbox.ID, Status: store.ARCHIVED})
		return err
	})
}

// deleteSpaceInvitationNotifications removes the receiver's notifications for
// the space once the invitation has been declined or revoked. A declined or
// revoked offer leaves nothing the receiver can act on.
func (s *APIV1Service) deleteSpaceInvitationNotifications(ctx context.Context, receiverID, spaceID int32) {
	s.forEachSpaceInvitationNotification(ctx, receiverID, spaceID, func(inbox *store.Inbox) error {
		return s.Store.DeleteInbox(ctx, &store.DeleteInbox{ID: inbox.ID})
	})
}

func (s *APIV1Service) forEachSpaceInvitationNotification(ctx context.Context, receiverID, spaceID int32, apply func(*store.Inbox) error) {
	messageType := storepb.InboxMessage_SPACE_INVITATION
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{ReceiverID: &receiverID, MessageType: &messageType})
	if err != nil {
		slog.Warn("Failed to list space invitation notifications",
			slog.Any("err", err),
			slog.Int64("space_id", int64(spaceID)),
			slog.Int64("receiver_id", int64(receiverID)))
		return
	}
	for _, inbox := range inboxes {
		if inbox.Message.GetSpaceInvitation().GetSpaceId() != spaceID {
			continue
		}
		if err := apply(inbox); err != nil {
			slog.Warn("Failed to resolve space invitation notification",
				slog.Any("err", err),
				slog.Int64("inbox_id", int64(inbox.ID)),
				slog.Int64("space_id", int64(spaceID)),
				slog.Int64("receiver_id", int64(receiverID)))
		}
	}
}

// spaceInvitationNotificationContext carries the viewer's relationship with
// the spaces referenced by a batch of inbox items. An invitation notification
// is only readable while the viewer holds the pending offer or accepted it.
type spaceInvitationNotificationContext struct {
	spacesByID       map[int32]*store.Space
	pendingBySpaceID map[int32]store.SpaceMemberRole
	memberBySpaceID  map[int32]store.SpaceMemberRole
}

func (c *spaceInvitationNotificationContext) resolve(spaceID int32) (*store.Space, store.SpaceMemberRole, v1pb.UserNotification_SpaceInvitationPayload_State) {
	if c == nil {
		return nil, "", v1pb.UserNotification_SpaceInvitationPayload_STATE_UNSPECIFIED
	}
	space := c.spacesByID[spaceID]
	if space == nil {
		return nil, "", v1pb.UserNotification_SpaceInvitationPayload_STATE_UNSPECIFIED
	}
	if role, ok := c.pendingBySpaceID[spaceID]; ok {
		return space, role, v1pb.UserNotification_SpaceInvitationPayload_PENDING
	}
	if role, ok := c.memberBySpaceID[spaceID]; ok {
		return space, role, v1pb.UserNotification_SpaceInvitationPayload_ACCEPTED
	}
	return nil, "", v1pb.UserNotification_SpaceInvitationPayload_STATE_UNSPECIFIED
}

func collectInboxSpaceIDs(inboxes []*store.Inbox) []int32 {
	spaceIDs := make([]int32, 0, len(inboxes))
	seen := make(map[int32]struct{}, len(inboxes))
	for _, inbox := range inboxes {
		if inbox == nil || inbox.Message == nil || inbox.Message.Type != storepb.InboxMessage_SPACE_INVITATION {
			continue
		}
		spaceID := inbox.Message.GetSpaceInvitation().GetSpaceId()
		if spaceID <= 0 {
			continue
		}
		if _, ok := seen[spaceID]; ok {
			continue
		}
		seen[spaceID] = struct{}{}
		spaceIDs = append(spaceIDs, spaceID)
	}
	return spaceIDs
}

func (s *APIV1Service) loadSpaceInvitationNotificationContext(ctx context.Context, viewer *store.User, inboxes []*store.Inbox) (*spaceInvitationNotificationContext, error) {
	result := &spaceInvitationNotificationContext{
		spacesByID:       map[int32]*store.Space{},
		pendingBySpaceID: map[int32]store.SpaceMemberRole{},
		memberBySpaceID:  map[int32]store.SpaceMemberRole{},
	}
	spaceIDs := collectInboxSpaceIDs(inboxes)
	if viewer == nil || len(spaceIDs) == 0 {
		return result, nil
	}

	spaces, err := s.Store.ListSpaces(ctx, &store.FindSpace{IDList: spaceIDs})
	if err != nil {
		return nil, err
	}
	for _, space := range spaces {
		result.spacesByID[space.ID] = space
	}
	invitations, err := s.Store.ListSpaceInvitations(ctx, &store.FindSpaceInvitation{UserID: &viewer.ID, ViewerUserID: &viewer.ID})
	if err != nil {
		return nil, err
	}
	for _, invitation := range invitations {
		result.pendingBySpaceID[invitation.SpaceID] = invitation.Role
	}
	members, err := s.Store.ListSpaceMembers(ctx, &store.FindSpaceMember{UserID: &viewer.ID, ViewerUserID: &viewer.ID})
	if err != nil {
		return nil, err
	}
	for _, member := range members {
		result.memberBySpaceID[member.SpaceID] = member.Role
	}
	return result, nil
}

// convertSpaceInvitationNotificationPayload returns nil when the viewer no
// longer holds a pending or accepted invitation for the space, so the
// notification fails closed without leaking Space metadata.
func convertSpaceInvitationNotificationPayload(inbox *store.Inbox, viewer *store.User, spaceContext *spaceInvitationNotificationContext) *v1pb.UserNotification_SpaceInvitationPayload {
	if inbox == nil || inbox.Message == nil || viewer == nil {
		return nil
	}
	space, role, state := spaceContext.resolve(inbox.Message.GetSpaceInvitation().GetSpaceId())
	if space == nil || state == v1pb.UserNotification_SpaceInvitationPayload_STATE_UNSPECIFIED {
		return nil
	}
	convertedRole := convertSpaceMemberRoleFromStore(role)
	if convertedRole == v1pb.SpaceMember_ROLE_UNSPECIFIED {
		return nil
	}
	return &v1pb.UserNotification_SpaceInvitationPayload{
		SpaceInvitation: buildSpaceInvitationName(space.UID, viewer.Username),
		Space:           convertSpaceMetadataFromStore(space),
		Role:            convertedRole,
		State:           state,
	}
}

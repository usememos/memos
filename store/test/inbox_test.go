package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestInboxStore(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	const systemBotID int32 = 0
	create := &store.Inbox{
		SenderID:   systemBotID,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
		},
	}
	inbox, err := ts.CreateInbox(ctx, create)
	require.NoError(t, err)
	require.NotNil(t, inbox)
	require.Equal(t, create.Message, inbox.Message)
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(inboxes))
	require.Equal(t, inbox, inboxes[0])
	updatedInbox, err := ts.UpdateInbox(ctx, &store.UpdateInbox{
		ID:     inbox.ID,
		Status: store.ARCHIVED,
	})
	require.NoError(t, err)
	require.NotNil(t, updatedInbox)
	require.Equal(t, store.ARCHIVED, updatedInbox.Status)
	err = ts.DeleteInbox(ctx, &store.DeleteInbox{
		ID: inbox.ID,
	})
	require.NoError(t, err)
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 0, len(inboxes))
	ts.Close()
}

func TestInboxListByID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	inbox, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// List by ID
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &inbox.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, inbox.ID, inboxes[0].ID)

	// List by non-existent ID
	nonExistentID := int32(99999)
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{ID: &nonExistentID})
	require.NoError(t, err)
	require.Len(t, inboxes, 0)

	ts.Close()
}

func TestInboxListBySenderID(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create inbox from system bot (senderID = 0)
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// Create inbox from user2
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   user2.ID,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// List by sender ID = user2
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{SenderID: &user2.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, user2.ID, inboxes[0].SenderID)

	// List by sender ID = 0 (system bot)
	systemBotID := int32(0)
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{SenderID: &systemBotID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, int32(0), inboxes[0].SenderID)

	ts.Close()
}

func TestInboxListByStatus(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create UNREAD inbox
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// Create another inbox and archive it
	inbox2, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)
	_, err = ts.UpdateInbox(ctx, &store.UpdateInbox{ID: inbox2.ID, Status: store.ARCHIVED})
	require.NoError(t, err)

	// List by UNREAD status
	unreadStatus := store.UNREAD
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{Status: &unreadStatus})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, store.UNREAD, inboxes[0].Status)

	// List by ARCHIVED status
	archivedStatus := store.ARCHIVED
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{Status: &archivedStatus})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, store.ARCHIVED, inboxes[0].Status)

	ts.Close()
}

func TestInboxListByMessageType(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create MEMO_COMMENT inboxes
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// List by MEMO_COMMENT type
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{MessageType: &memoCommentType})
	require.NoError(t, err)
	require.Len(t, inboxes, 2)
	for _, inbox := range inboxes {
		require.Equal(t, storepb.InboxMessage_MEMO_COMMENT, inbox.Message.Type)
	}

	ts.Close()
}

func TestInboxListPagination(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create 5 inboxes
	for i := 0; i < 5; i++ {
		_, err = ts.CreateInbox(ctx, &store.Inbox{
			SenderID:   0,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
		})
		require.NoError(t, err)
	}

	// Test Limit only
	limit := 3
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
		Limit:      &limit,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 3)

	// Test Limit + Offset (offset requires limit in the implementation)
	limit = 2
	offset := 2
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
		Limit:      &limit,
		Offset:     &offset,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 2)

	// Test Limit + Offset skipping to end
	limit = 10
	offset = 3
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user.ID,
		Limit:      &limit,
		Offset:     &offset,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 2) // Only 2 remaining after offset of 3

	ts.Close()
}

func TestInboxListCombinedFilters(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create various inboxes
	// user2 -> user1, MEMO_COMMENT, UNREAD
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   user2.ID,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// user2 -> user1, TYPE_UNSPECIFIED, UNREAD
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   user2.ID,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_TYPE_UNSPECIFIED},
	})
	require.NoError(t, err)

	// system -> user1, MEMO_COMMENT, ARCHIVED
	inbox3, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)
	_, err = ts.UpdateInbox(ctx, &store.UpdateInbox{ID: inbox3.ID, Status: store.ARCHIVED})
	require.NoError(t, err)

	// Combined filter: ReceiverID + SenderID + Status
	unreadStatus := store.UNREAD
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID: &user1.ID,
		SenderID:   &user2.ID,
		Status:     &unreadStatus,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 2)

	// Combined filter: ReceiverID + MessageType + Status
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user1.ID,
		MessageType: &memoCommentType,
		Status:      &unreadStatus,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, user2.ID, inboxes[0].SenderID)

	ts.Close()
}

func TestInboxMessagePayload(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create inbox with message payload containing activity ID
	activityID := int32(123)
	inbox, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type:       storepb.InboxMessage_MEMO_COMMENT,
			ActivityId: &activityID,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, inbox.Message)
	require.Equal(t, storepb.InboxMessage_MEMO_COMMENT, inbox.Message.Type)
	require.Equal(t, activityID, *inbox.Message.ActivityId)

	// List and verify payload is preserved
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, activityID, *inboxes[0].Message.ActivityId)

	ts.Close()
}

func TestInboxUpdateStatus(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	inbox, err := ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)
	require.Equal(t, store.UNREAD, inbox.Status)

	// Update to ARCHIVED
	updated, err := ts.UpdateInbox(ctx, &store.UpdateInbox{
		ID:     inbox.ID,
		Status: store.ARCHIVED,
	})
	require.NoError(t, err)
	require.Equal(t, store.ARCHIVED, updated.Status)
	require.Equal(t, inbox.ID, updated.ID)

	// Verify the update persisted
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ID: &inbox.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, store.ARCHIVED, inboxes[0].Status)

	ts.Close()
}

func TestInboxListByMessageTypeMultipleTypes(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create inboxes with different message types
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_TYPE_UNSPECIFIED},
	})
	require.NoError(t, err)

	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// Filter by MEMO_COMMENT - should get 2
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &memoCommentType,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 2)
	for _, inbox := range inboxes {
		require.Equal(t, storepb.InboxMessage_MEMO_COMMENT, inbox.Message.Type)
	}

	// Filter by TYPE_UNSPECIFIED - should get 1
	unspecifiedType := storepb.InboxMessage_TYPE_UNSPECIFIED
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &unspecifiedType,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, storepb.InboxMessage_TYPE_UNSPECIFIED, inboxes[0].Message.Type)

	ts.Close()
}

func TestInboxMessageTypeFilterWithPayload(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create inbox with full payload
	activityID := int32(456)
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type:       storepb.InboxMessage_MEMO_COMMENT,
			ActivityId: &activityID,
		},
	})
	require.NoError(t, err)

	// Create inbox with different type but also has payload
	otherActivityID := int32(789)
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type:       storepb.InboxMessage_TYPE_UNSPECIFIED,
			ActivityId: &otherActivityID,
		},
	})
	require.NoError(t, err)

	// Filter by type should work correctly even with complex JSON payload
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &memoCommentType,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, activityID, *inboxes[0].Message.ActivityId)

	ts.Close()
}

func TestInboxMessageTypeFilterWithStatusAndPagination(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Create multiple inboxes with various combinations
	for i := 0; i < 5; i++ {
		_, err = ts.CreateInbox(ctx, &store.Inbox{
			SenderID:   0,
			ReceiverID: user.ID,
			Status:     store.UNREAD,
			Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
		})
		require.NoError(t, err)
	}

	// Archive 2 of them
	allInboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user.ID})
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		_, err = ts.UpdateInbox(ctx, &store.UpdateInbox{ID: allInboxes[i].ID, Status: store.ARCHIVED})
		require.NoError(t, err)
	}

	// Filter by type + status + pagination
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	unreadStatus := store.UNREAD
	limit := 2
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &memoCommentType,
		Status:      &unreadStatus,
		Limit:       &limit,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 2)
	for _, inbox := range inboxes {
		require.Equal(t, storepb.InboxMessage_MEMO_COMMENT, inbox.Message.Type)
		require.Equal(t, store.UNREAD, inbox.Status)
	}

	// Get next page
	offset := 2
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &user.ID,
		MessageType: &memoCommentType,
		Status:      &unreadStatus,
		Limit:       &limit,
		Offset:      &offset,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1) // Only 1 remaining (3 unread total, got 2, now 1 left)

	ts.Close()
}

func TestInboxMultipleReceivers(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user1, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	user2, err := createTestingUserWithRole(ctx, ts, "user2", store.RoleUser)
	require.NoError(t, err)

	// Create inbox for user1
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user1.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// Create inbox for user2
	_, err = ts.CreateInbox(ctx, &store.Inbox{
		SenderID:   0,
		ReceiverID: user2.ID,
		Status:     store.UNREAD,
		Message:    &storepb.InboxMessage{Type: storepb.InboxMessage_MEMO_COMMENT},
	})
	require.NoError(t, err)

	// User1 should only see their inbox
	inboxes, err := ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user1.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, user1.ID, inboxes[0].ReceiverID)

	// User2 should only see their inbox
	inboxes, err = ts.ListInboxes(ctx, &store.FindInbox{ReceiverID: &user2.ID})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.Equal(t, user2.ID, inboxes[0].ReceiverID)

	ts.Close()
}

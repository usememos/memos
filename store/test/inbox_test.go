package teststore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestInboxStore(t *testing.T) {
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

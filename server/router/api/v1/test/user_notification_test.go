package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestListUserNotificationsIncludesMemoCommentPayload(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "notification-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "notification-commenter")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Base memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	comment, err := ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment content",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%d", owner.ID),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)

	notification := resp.Notifications[0]
	require.Equal(t, apiv1.UserNotification_MEMO_COMMENT, notification.Type)
	require.NotNil(t, notification.GetMemoComment())
	require.Equal(t, comment.Name, notification.GetMemoComment().Memo)
	require.Equal(t, memo.Name, notification.GetMemoComment().RelatedMemo)
}

func TestListUserNotificationsOmitsPayloadWhenActivityMissing(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "notification-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "notification-commenter")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Base memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment content",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	messageType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := ts.Store.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &owner.ID,
		MessageType: &messageType,
	})
	require.NoError(t, err)
	require.Len(t, inboxes, 1)
	require.NotNil(t, inboxes[0].Message)
	require.NotNil(t, inboxes[0].Message.ActivityId)

	_, err = ts.Store.GetDriver().GetDB().ExecContext(ctx, "DELETE FROM activity WHERE id = ?", *inboxes[0].Message.ActivityId)
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%d", owner.ID),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)
	require.Nil(t, resp.Notifications[0].GetMemoComment())
}

func TestListUserNotificationsOmitsPayloadWhenMemosDeleted(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "notification-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "notification-commenter")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Base memo",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment content",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.DeleteMemo(ownerCtx, &apiv1.DeleteMemoRequest{
		Name: memo.Name,
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%d", owner.ID),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_COMMENT, resp.Notifications[0].Type)
	require.Nil(t, resp.Notifications[0].GetMemoComment())
}

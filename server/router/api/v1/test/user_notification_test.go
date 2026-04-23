package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

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
		Parent: fmt.Sprintf("users/%s", owner.Username),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)

	notification := resp.Notifications[0]
	require.Contains(t, notification.Name, fmt.Sprintf("users/%s/notifications/", owner.Username))
	require.Equal(t, fmt.Sprintf("users/%s", commenter.Username), notification.Sender)
	require.NotNil(t, notification.SenderUser)
	require.Equal(t, commenter.Username, notification.SenderUser.Username)
	require.Equal(t, apiv1.UserNotification_MEMO_COMMENT, notification.Type)
	require.NotNil(t, notification.GetMemoComment())
	require.Equal(t, comment.Name, notification.GetMemoComment().Memo)
	require.Equal(t, memo.Name, notification.GetMemoComment().RelatedMemo)
	require.Equal(t, "Comment content", notification.GetMemoComment().MemoSnippet)
	require.Equal(t, "Base memo", notification.GetMemoComment().RelatedMemoSnippet)
}

func TestListUserNotificationsStoresMemoCommentPayloadInInbox(t *testing.T) {
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
	require.NotNil(t, inboxes[0].Message.GetMemoComment())
	require.NotZero(t, inboxes[0].Message.GetMemoComment().MemoId)
	require.NotZero(t, inboxes[0].Message.GetMemoComment().RelatedMemoId)
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
		Parent: fmt.Sprintf("users/%s", owner.Username),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_COMMENT, resp.Notifications[0].Type)
	require.Nil(t, resp.Notifications[0].GetMemoComment())
}

func TestListUserNotificationsSkipsNotificationsWithMissingUsers(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "notification-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "notification-orphan")
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

	err = ts.Store.DeleteUser(ctx, &store.DeleteUser{ID: commenter.ID})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", owner.Username),
	})
	require.NoError(t, err)
	require.Empty(t, resp.Notifications)
}

func TestListUserNotificationsRejectsNumericParent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "notification-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	_, err = ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: "users/1",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "user not found")
}

func TestListUserNotificationsIncludesMemoMentionPayload(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	author, err := ts.CreateRegularUser(ctx, "mention-author")
	require.NoError(t, err)
	authorCtx := ts.CreateUserContext(ctx, author.ID)

	target, err := ts.CreateRegularUser(ctx, "mention-target")
	require.NoError(t, err)
	targetCtx := ts.CreateUserContext(ctx, target.ID)

	memo, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    fmt.Sprintf("Hello @%s", target.Username),
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(targetCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", target.Username),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_MENTION, resp.Notifications[0].Type)
	require.NotNil(t, resp.Notifications[0].GetMemoMention())
	require.Equal(t, memo.Name, resp.Notifications[0].GetMemoMention().Memo)
	require.Empty(t, resp.Notifications[0].GetMemoMention().RelatedMemo)
	require.Equal(t, author.Username, resp.Notifications[0].SenderUser.Username)
	require.Equal(t, "Hello", resp.Notifications[0].GetMemoMention().MemoSnippet)
}

func TestCreateMemoCommentMentionDoesNotDuplicateOwnerNotification(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "mention-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "mention-commenter")
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
			Content:    fmt.Sprintf("Hi @%s", owner.Username),
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListUserNotifications(ownerCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", owner.Username),
	})
	require.NoError(t, err)
	require.Len(t, resp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_COMMENT, resp.Notifications[0].Type)
}

func TestUpdateMemoMentionOnlyNotifiesNewTargets(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	author, err := ts.CreateRegularUser(ctx, "mention-update-author")
	require.NoError(t, err)
	authorCtx := ts.CreateUserContext(ctx, author.ID)

	firstTarget, err := ts.CreateRegularUser(ctx, "mention-update-first")
	require.NoError(t, err)
	firstTargetCtx := ts.CreateUserContext(ctx, firstTarget.ID)

	secondTarget, err := ts.CreateRegularUser(ctx, "mention-update-second")
	require.NoError(t, err)
	secondTargetCtx := ts.CreateUserContext(ctx, secondTarget.ID)

	memo, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	updatedMemo, err := ts.Service.UpdateMemo(authorCtx, &apiv1.UpdateMemoRequest{
		Memo: &apiv1.Memo{
			Name:       memo.Name,
			Content:    fmt.Sprintf("Hello @%s", firstTarget.Username),
			Visibility: apiv1.Visibility_PUBLIC,
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)

	firstResp, err := ts.Service.ListUserNotifications(firstTargetCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", firstTarget.Username),
	})
	require.NoError(t, err)
	require.Len(t, firstResp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_MENTION, firstResp.Notifications[0].Type)
	require.Equal(t, updatedMemo.Name, firstResp.Notifications[0].GetMemoMention().Memo)

	_, err = ts.Service.UpdateMemo(authorCtx, &apiv1.UpdateMemoRequest{
		Memo: &apiv1.Memo{
			Name:       memo.Name,
			Content:    fmt.Sprintf("Hello again @%s and @%s", firstTarget.Username, secondTarget.Username),
			Visibility: apiv1.Visibility_PUBLIC,
		},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
	})
	require.NoError(t, err)

	firstResp, err = ts.Service.ListUserNotifications(firstTargetCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", firstTarget.Username),
	})
	require.NoError(t, err)
	require.Len(t, firstResp.Notifications, 1)

	secondResp, err := ts.Service.ListUserNotifications(secondTargetCtx, &apiv1.ListUserNotificationsRequest{
		Parent: fmt.Sprintf("users/%s", secondTarget.Username),
	})
	require.NoError(t, err)
	require.Len(t, secondResp.Notifications, 1)
	require.Equal(t, apiv1.UserNotification_MEMO_MENTION, secondResp.Notifications[0].Type)
}

package test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	"github.com/usememos/memos/internal/email"
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

func TestCreateMemoCommentSendsEmailNotificationWhenEnabled(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	var sentConfig *email.Config
	var sentMessage *email.Message
	ts.Service.NotificationEmailSender = func(config *email.Config, message *email.Message) {
		sentConfig = config
		sentMessage = message
	}

	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{
				Email: &storepb.InstanceNotificationSetting_EmailSetting{
					Enabled:      true,
					SmtpHost:     "smtp.example.com",
					SmtpPort:     587,
					SmtpUsername: "bot@example.com",
					SmtpPassword: "password",
					FromEmail:    "bot@example.com",
					FromName:     "Memos",
					ReplyTo:      "reply@example.com",
					UseTls:       true,
				},
			},
		},
	})
	require.NoError(t, err)

	owner, err := ts.CreateRegularUser(ctx, "email-comment-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "email-commenter")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Base memo for email",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	comment, err := ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo.Name,
		Comment: &apiv1.Memo{
			Content:    "Email comment content",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	require.NotNil(t, sentConfig)
	require.Equal(t, "smtp.example.com", sentConfig.SMTPHost)
	require.Equal(t, 587, sentConfig.SMTPPort)
	require.Equal(t, "bot@example.com", sentConfig.FromEmail)
	require.True(t, sentConfig.UseTLS)

	require.NotNil(t, sentMessage)
	require.Equal(t, []string{owner.Email}, sentMessage.To)
	require.Equal(t, "reply@example.com", sentMessage.ReplyTo)
	require.Contains(t, sentMessage.Subject, "commented on your memo")
	require.Contains(t, sentMessage.Body, "Hi email-comment-owner,")
	require.Contains(t, sentMessage.Body, "email-commenter commented on your memo.")
	require.Contains(t, sentMessage.Body, fmt.Sprintf("http://localhost:8080/%s#%s", memo.Name, strings.TrimPrefix(comment.Name, "memos/")))
	require.Contains(t, sentMessage.Body, "You are receiving this because you own this memo.")
	require.NotContains(t, sentMessage.Body, "Email comment content")
	require.NotContains(t, sentMessage.Body, "Base memo for email")
}

func TestCreateMemoMentionSendsEmailNotificationWhenEnabled(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	var sentMessage *email.Message
	ts.Service.NotificationEmailSender = func(_ *email.Config, message *email.Message) {
		sentMessage = message
	}

	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{
				Email: &storepb.InstanceNotificationSetting_EmailSetting{
					Enabled:   true,
					SmtpHost:  "smtp.example.com",
					SmtpPort:  587,
					FromEmail: "bot@example.com",
				},
			},
		},
	})
	require.NoError(t, err)

	author, err := ts.CreateRegularUser(ctx, "email-mention-author")
	require.NoError(t, err)
	authorCtx := ts.CreateUserContext(ctx, author.ID)

	target, err := ts.CreateRegularUser(ctx, "email-mention-target")
	require.NoError(t, err)

	memo, err := ts.Service.CreateMemo(authorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    fmt.Sprintf("Hello @%s from email", target.Username),
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	require.NotNil(t, sentMessage)
	require.Equal(t, []string{target.Email}, sentMessage.To)
	require.Contains(t, sentMessage.Subject, "mentioned you in a memo")
	require.Contains(t, sentMessage.Body, "Hi email-mention-target,")
	require.Contains(t, sentMessage.Body, "email-mention-author mentioned you in a memo.")
	require.Contains(t, sentMessage.Body, fmt.Sprintf("http://localhost:8080/%s", memo.Name))
	require.Contains(t, sentMessage.Body, "You are receiving this because you were mentioned in this memo.")
	require.NotContains(t, sentMessage.Body, "Hello")
	require.NotContains(t, sentMessage.Body, fmt.Sprintf("Hello @%s from email", target.Username))
}

func TestCreateMemoCommentSkipsEmailNotificationWithoutInstanceURL(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	ts.Profile.InstanceURL = ""

	var sentMessage *email.Message
	ts.Service.NotificationEmailSender = func(_ *email.Config, message *email.Message) {
		sentMessage = message
	}

	_, err := ts.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_NOTIFICATION,
		Value: &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: &storepb.InstanceNotificationSetting{
				Email: &storepb.InstanceNotificationSetting_EmailSetting{
					Enabled:   true,
					SmtpHost:  "smtp.example.com",
					SmtpPort:  587,
					FromEmail: "bot@example.com",
				},
			},
		},
	})
	require.NoError(t, err)

	owner, err := ts.CreateRegularUser(ctx, "email-comment-no-url-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)

	commenter, err := ts.CreateRegularUser(ctx, "email-comment-no-url-commenter")
	require.NoError(t, err)
	commenterCtx := ts.CreateUserContext(ctx, commenter.ID)

	memo, err := ts.Service.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "Base memo without instance URL",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)

	_, err = ts.Service.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: memo.Name,
		Comment: &apiv1.Memo{
			Content:    "Comment without instance URL",
			Visibility: apiv1.Visibility_PUBLIC,
		},
	})
	require.NoError(t, err)
	require.Nil(t, sentMessage)
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

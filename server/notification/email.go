package notification

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/email"
	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// EmailSender sends a prepared email message with the given SMTP configuration.
type EmailSender func(*email.Config, *email.Message)

// EmailDispatcher dispatches notification emails for inbox events.
type EmailDispatcher struct {
	profile *profile.Profile
	store   *store.Store
	sender  EmailSender
}

// NewEmailDispatcher creates a notification email dispatcher.
func NewEmailDispatcher(profile *profile.Profile, store *store.Store, sender EmailSender) *EmailDispatcher {
	if sender == nil {
		sender = email.SendAsync
	}
	return &EmailDispatcher{
		profile: profile,
		store:   store,
		sender:  sender,
	}
}

// DispatchInboxEmail sends the email notification for an inbox entry when configured.
func (d *EmailDispatcher) DispatchInboxEmail(ctx context.Context, inbox *store.Inbox) error {
	if inbox == nil || inbox.Message == nil {
		return nil
	}

	setting, err := d.store.GetInstanceNotificationSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get notification setting")
	}
	emailSetting := setting.GetEmail()
	if emailSetting == nil || !emailSetting.Enabled {
		return nil
	}
	if d.baseURL() == "" {
		slog.Warn("Skipping inbox email notification because instance URL is required",
			slog.Int64("inbox_id", int64(inbox.ID)),
			slog.Int64("receiver_id", int64(inbox.ReceiverID)))
		return nil
	}

	receiver, err := d.store.GetUser(ctx, &store.FindUser{ID: &inbox.ReceiverID})
	if err != nil {
		return errors.Wrap(err, "failed to get notification receiver")
	}
	if receiver == nil || strings.TrimSpace(receiver.Email) == "" {
		return nil
	}

	sender, err := d.store.GetUser(ctx, &store.FindUser{ID: &inbox.SenderID})
	if err != nil {
		return errors.Wrap(err, "failed to get notification sender")
	}
	if sender == nil {
		return nil
	}

	memosByID, err := d.listMemosByID(ctx, collectInboxMemoIDs([]*store.Inbox{inbox}))
	if err != nil {
		return errors.Wrap(err, "failed to get notification memos")
	}

	message, err := d.buildInboxEmailMessage(inbox, receiver, sender, memosByID)
	if err != nil {
		return err
	}
	if message == nil {
		return nil
	}
	message.ReplyTo = emailSetting.ReplyTo

	config := EmailConfigFromInstanceSetting(emailSetting)
	if err := config.Validate(); err != nil {
		return errors.Wrap(err, "invalid notification email setting")
	}

	d.sender(config, message)
	return nil
}

// EmailConfigFromInstanceSetting converts persisted notification settings into SMTP config.
func EmailConfigFromInstanceSetting(setting *storepb.InstanceNotificationSetting_EmailSetting) *email.Config {
	if setting == nil {
		return &email.Config{}
	}
	return &email.Config{
		SMTPHost:     setting.SmtpHost,
		SMTPPort:     int(setting.SmtpPort),
		SMTPUsername: setting.SmtpUsername,
		SMTPPassword: setting.SmtpPassword,
		FromEmail:    setting.FromEmail,
		FromName:     setting.FromName,
		UseTLS:       setting.UseTls,
		UseSSL:       setting.UseSsl,
	}
}

// NewTestEmailMessage builds the plain-text test email for notification settings.
func NewTestEmailMessage(recipientEmail, replyTo string) *email.Message {
	return &email.Message{
		To:      []string{recipientEmail},
		Subject: "[Memos] Test email",
		Body:    "This is a test email from your Memos notification settings.",
		ReplyTo: replyTo,
	}
}

// ValidateEmailSetting validates notification email SMTP settings.
func ValidateEmailSetting(setting *storepb.InstanceNotificationSetting_EmailSetting) error {
	return EmailConfigFromInstanceSetting(setting).Validate()
}

// SendTestEmail sends a plain-text test email using notification email settings.
func SendTestEmail(setting *storepb.InstanceNotificationSetting_EmailSetting, recipientEmail string) error {
	return email.Send(EmailConfigFromInstanceSetting(setting), NewTestEmailMessage(recipientEmail, setting.GetReplyTo()))
}

func (d *EmailDispatcher) buildInboxEmailMessage(inbox *store.Inbox, receiver *store.User, sender *store.User, memosByID map[int32]*store.Memo) (*email.Message, error) {
	senderName := displayNameForEmail(sender)
	switch inbox.Message.Type {
	case storepb.InboxMessage_MEMO_COMMENT:
		return d.buildMemoCommentEmailMessage(inbox.Message, receiver, senderName, memosByID)
	case storepb.InboxMessage_MEMO_MENTION:
		return d.buildMemoMentionEmailMessage(inbox.Message, receiver, senderName, memosByID)
	default:
		return nil, nil
	}
}

func (d *EmailDispatcher) buildMemoCommentEmailMessage(message *storepb.InboxMessage, receiver *store.User, senderName string, memosByID map[int32]*store.Memo) (*email.Message, error) {
	payload := message.GetMemoComment()
	if payload == nil {
		return nil, nil
	}
	commentMemo := memosByID[payload.MemoId]
	relatedMemo := memosByID[payload.RelatedMemoId]
	if !canViewerAccessMemo(receiver, commentMemo) || !canViewerAccessMemo(receiver, relatedMemo) {
		return nil, nil
	}
	url := d.memoCommentURL(relatedMemo, commentMemo)
	if url == "" {
		return nil, nil
	}

	body := []string{
		fmt.Sprintf("Hi %s,", displayNameForEmail(receiver)),
		"",
		fmt.Sprintf("%s commented on your memo.", senderName),
		"",
		"Open in Memos:",
		url,
		"",
		"You are receiving this because you own this memo.",
	}

	return &email.Message{
		To:      []string{receiver.Email},
		Subject: fmt.Sprintf("[Memos] %s commented on your memo", senderName),
		Body:    strings.Join(body, "\n"),
	}, nil
}

func (d *EmailDispatcher) buildMemoMentionEmailMessage(message *storepb.InboxMessage, receiver *store.User, senderName string, memosByID map[int32]*store.Memo) (*email.Message, error) {
	payload := message.GetMemoMention()
	if payload == nil {
		return nil, nil
	}
	memo := memosByID[payload.MemoId]
	if !canViewerAccessMemo(receiver, memo) {
		return nil, nil
	}
	url := d.memoURL(memo)
	if url == "" {
		return nil, nil
	}

	body := []string{
		fmt.Sprintf("Hi %s,", displayNameForEmail(receiver)),
		"",
		fmt.Sprintf("%s mentioned you in a memo.", senderName),
		"",
		"Open in Memos:",
		url,
		"",
		"You are receiving this because you were mentioned in this memo.",
	}

	return &email.Message{
		To:      []string{receiver.Email},
		Subject: fmt.Sprintf("[Memos] %s mentioned you in a memo", senderName),
		Body:    strings.Join(body, "\n"),
	}, nil
}

func (d *EmailDispatcher) listMemosByID(ctx context.Context, memoIDs []int32) (map[int32]*store.Memo, error) {
	if len(memoIDs) == 0 {
		return map[int32]*store.Memo{}, nil
	}

	uniqueMemoIDs := make([]int32, 0, len(memoIDs))
	seenMemoIDs := make(map[int32]struct{}, len(memoIDs))
	for _, memoID := range memoIDs {
		if memoID == 0 {
			continue
		}
		if _, seen := seenMemoIDs[memoID]; seen {
			continue
		}
		seenMemoIDs[memoID] = struct{}{}
		uniqueMemoIDs = append(uniqueMemoIDs, memoID)
	}
	if len(uniqueMemoIDs) == 0 {
		return map[int32]*store.Memo{}, nil
	}

	memos, err := d.store.ListMemos(ctx, &store.FindMemo{IDList: uniqueMemoIDs})
	if err != nil {
		return nil, err
	}

	memosByID := make(map[int32]*store.Memo, len(memos))
	for _, memo := range memos {
		memosByID[memo.ID] = memo
	}
	return memosByID, nil
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

func displayNameForEmail(user *store.User) string {
	if user == nil {
		return "there"
	}
	if strings.TrimSpace(user.Nickname) != "" {
		return user.Nickname
	}
	if strings.TrimSpace(user.Username) != "" {
		return user.Username
	}
	return "there"
}

func (d *EmailDispatcher) baseURL() string {
	if d.profile == nil || strings.TrimSpace(d.profile.InstanceURL) == "" {
		return ""
	}
	return strings.TrimRight(strings.TrimSpace(d.profile.InstanceURL), "/")
}

func (d *EmailDispatcher) memoURL(memo *store.Memo) string {
	baseURL := d.baseURL()
	if memo == nil || memo.UID == "" || baseURL == "" {
		return ""
	}
	return fmt.Sprintf("%s/memos/%s", baseURL, memo.UID)
}

func (d *EmailDispatcher) memoCommentURL(relatedMemo *store.Memo, commentMemo *store.Memo) string {
	baseURL := d.baseURL()
	if relatedMemo == nil || relatedMemo.UID == "" || commentMemo == nil || commentMemo.UID == "" || baseURL == "" {
		return ""
	}
	return fmt.Sprintf("%s/memos/%s#%s", baseURL, relatedMemo.UID, commentMemo.UID)
}

func canViewerAccessMemo(viewer *store.User, memo *store.Memo) bool {
	if memo == nil {
		return false
	}
	if viewer != nil && viewer.Role == store.RoleAdmin {
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

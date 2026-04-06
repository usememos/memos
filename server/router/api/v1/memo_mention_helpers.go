package v1

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// suppressMentionKey is a context key used to suppress mention notification side effects
// when CreateMemo is called internally from CreateMemoComment.
type suppressMentionKey struct{}

func withSuppressMentionNotifications(ctx context.Context) context.Context {
	return context.WithValue(ctx, suppressMentionKey{}, true)
}

func isMentionNotificationSuppressed(ctx context.Context) bool {
	v, ok := ctx.Value(suppressMentionKey{}).(bool)
	return ok && v
}

func (s *APIV1Service) resolveMentionTargets(ctx context.Context, content string) (map[int32]*store.User, error) {
	targets := make(map[int32]*store.User)
	if content == "" {
		return targets, nil
	}

	data, err := s.MarkdownService.ExtractAll([]byte(content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to extract mentions")
	}
	if len(data.Mentions) == 0 {
		return targets, nil
	}

	normal := store.Normal
	users, err := s.Store.ListUsers(ctx, &store.FindUser{
		UsernameList: data.Mentions,
		RowStatus:    &normal,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to resolve mention users")
	}

	for _, user := range users {
		targets[user.ID] = user
	}

	return targets, nil
}

func canUserAccessMentionContext(target *store.User, memo *store.Memo, relatedMemo *store.Memo) bool {
	if target == nil || memo == nil {
		return false
	}

	if relatedMemo != nil {
		if relatedMemo.Visibility == store.Private && target.ID != relatedMemo.CreatorID {
			return false
		}
	}

	if memo.Visibility == store.Private && target.ID != memo.CreatorID {
		return false
	}

	return true
}

func shouldSkipMentionInbox(target *store.User, memo *store.Memo, relatedMemo *store.Memo) bool {
	if target == nil || memo == nil {
		return true
	}

	if target.ID == memo.CreatorID {
		return true
	}

	// Comment creation already generates a memo-comment inbox item for the parent creator.
	if relatedMemo != nil && target.ID == relatedMemo.CreatorID && memo.Visibility != store.Private && memo.CreatorID != relatedMemo.CreatorID {
		return true
	}

	return !canUserAccessMentionContext(target, memo, relatedMemo)
}

func (s *APIV1Service) dispatchMemoMentionNotifications(ctx context.Context, memo *store.Memo, relatedMemo *store.Memo, previousContent string) error {
	if memo == nil {
		return nil
	}

	currentTargets, err := s.resolveMentionTargets(ctx, memo.Content)
	if err != nil {
		return err
	}
	if len(currentTargets) == 0 {
		return nil
	}

	previousTargets, err := s.resolveMentionTargets(ctx, previousContent)
	if err != nil {
		return err
	}

	for userID, target := range currentTargets {
		if _, exists := previousTargets[userID]; exists {
			continue
		}
		if shouldSkipMentionInbox(target, memo, relatedMemo) {
			continue
		}

		payload := &storepb.InboxMessage_MemoMentionPayload{
			MemoId: memo.ID,
		}
		if relatedMemo != nil {
			payload.RelatedMemoId = relatedMemo.ID
		}

		if _, err := s.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   memo.CreatorID,
			ReceiverID: target.ID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type: storepb.InboxMessage_MEMO_MENTION,
				Payload: &storepb.InboxMessage_MemoMention{
					MemoMention: payload,
				},
			},
		}); err != nil {
			return errors.Wrap(err, "failed to create mention inbox")
		}
	}

	return nil
}

func (s *APIV1Service) dispatchMemoMentionNotificationsBestEffort(ctx context.Context, memo *store.Memo, relatedMemo *store.Memo, previousContent string) {
	if err := s.dispatchMemoMentionNotifications(ctx, memo, relatedMemo, previousContent); err != nil {
		slog.Warn("Failed to dispatch memo mention notifications", slog.Any("err", err), slog.Int64("memo_id", int64(memo.ID)))
	}
}

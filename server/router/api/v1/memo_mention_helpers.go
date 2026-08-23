package v1

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/access"
	"github.com/usememos/memos/store"
)

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

// mentionContextFacts holds the viewer-independent authorization facts for a
// mention's memo and its optional context memo. They are resolved once per
// dispatch and reused for every mentioned user.
type mentionContextFacts struct {
	memo    access.MemoReadFacts
	related *access.MemoReadFacts
}

func (s *APIV1Service) resolveMentionContextFacts(ctx context.Context, memo *store.Memo, relatedMemo *store.Memo) (*mentionContextFacts, error) {
	memoFacts, err := access.ResolveMemoReadFacts(ctx, s.Store, memo)
	if err != nil {
		return nil, err
	}
	facts := &mentionContextFacts{memo: memoFacts}
	if relatedMemo != nil {
		relatedFacts, err := access.ResolveMemoReadFacts(ctx, s.Store, relatedMemo)
		if err != nil {
			return nil, err
		}
		facts.related = &relatedFacts
	}
	return facts, nil
}

func (s *APIV1Service) canUserAccessMentionContext(ctx context.Context, facts *mentionContextFacts, target *store.User) bool {
	if target == nil || facts == nil || facts.memo.Memo == nil {
		return false
	}
	readContext, err := facts.memo.WithViewer(ctx, s.Store, target, false, nil)
	if err != nil || !access.CheckMemoReadContext(readContext).Allowed() {
		return false
	}
	if facts.related == nil {
		return true
	}
	relatedContext, err := facts.related.WithViewer(ctx, s.Store, target, false, nil)
	if err != nil {
		return false
	}
	return access.CheckMemoReadContext(relatedContext).Allowed()
}

// canUserAccessMentionMemos is the one-shot form for a single target, where
// there is no fan-out to amortize the fact resolution over.
func (s *APIV1Service) canUserAccessMentionMemos(ctx context.Context, target *store.User, memo *store.Memo, relatedMemo *store.Memo) bool {
	facts, err := s.resolveMentionContextFacts(ctx, memo, relatedMemo)
	if err != nil {
		return false
	}
	return s.canUserAccessMentionContext(ctx, facts, target)
}

func (s *APIV1Service) shouldSkipMentionInbox(ctx context.Context, facts *mentionContextFacts, target *store.User, memo *store.Memo, relatedMemo *store.Memo) bool {
	if target == nil || memo == nil {
		return true
	}

	if target.ID == memo.CreatorID {
		return true
	}

	// Comment creation already generates a memo-comment inbox item for the parent creator.
	if relatedMemo != nil && target.ID == relatedMemo.CreatorID && memo.CreatorID != relatedMemo.CreatorID {
		return true
	}

	return !s.canUserAccessMentionContext(ctx, facts, target)
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

	facts, err := s.resolveMentionContextFacts(ctx, memo, relatedMemo)
	if err != nil {
		return errors.Wrap(err, "failed to resolve mention context")
	}

	for userID, target := range currentTargets {
		if _, exists := previousTargets[userID]; exists {
			continue
		}
		if s.shouldSkipMentionInbox(ctx, facts, target, memo, relatedMemo) {
			continue
		}

		payload := &storepb.InboxMessage_MemoMentionPayload{
			MemoId: memo.ID,
		}
		if relatedMemo != nil {
			payload.RelatedMemoId = relatedMemo.ID
		}

		if _, err := s.createInboxWithEmailNotification(ctx, &store.Inbox{
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

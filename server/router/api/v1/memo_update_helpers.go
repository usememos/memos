package v1

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) buildUpdatedMemoState(ctx context.Context, memoID int32) (*store.Memo, *store.Memo, *v1pb.Memo, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoID})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to get memo")
	}
	if memo == nil {
		return nil, nil, nil, errors.New("memo not found")
	}

	memoName := buildMemoName(memo.UID)
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &memoName,
	})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to list reactions")
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to list attachments")
	}
	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to load memo relations")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, relations)
	if err != nil {
		return nil, nil, nil, errors.Wrap(err, "failed to convert memo")
	}

	var parentMemo *store.Memo
	if memo.ParentUID != nil {
		parentMemo, err = s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return nil, nil, nil, errors.Wrap(err, "failed to get parent memo")
		}
		if parentMemo == nil {
			return nil, nil, nil, errors.New("parent memo not found")
		}
		memoMessage.Visibility = convertVisibilityFromStore(parentMemo.Visibility)
	}

	return memo, parentMemo, memoMessage, nil
}

func (s *APIV1Service) dispatchMemoUpdatedSideEffects(ctx context.Context, memo *store.Memo, parentMemo *store.Memo, memoMessage *v1pb.Memo) {
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo updated webhook", slog.Any("err", err))
	}

	visibility := memo.Visibility
	if parentMemo != nil {
		visibility = parentMemo.Visibility
	}
	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoUpdated,
		Name:       memoMessage.Name,
		Parent:     memoMessage.GetParent(),
		Visibility: visibility,
		CreatorID:  resolveSSECreatorID(memo, parentMemo),
	})
}

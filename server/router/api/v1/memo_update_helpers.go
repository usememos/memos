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

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		MemoID: &memo.ID,
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

	var commentContext *store.Memo
	if memo.ParentUID != nil {
		commentContext, err = s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return nil, nil, nil, errors.Wrap(err, "failed to get comment context")
		}
	}

	return memo, commentContext, memoMessage, nil
}

func (s *APIV1Service) dispatchMemoUpdatedSideEffects(
	ctx context.Context,
	memoMessage *v1pb.Memo,
) {
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo updated webhook", slog.Any("err", err))
	}

	s.SSEHub.publishMemoChanged()
}

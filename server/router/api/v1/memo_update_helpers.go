package v1

import (
	"context"
	"log/slog"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) touchMemoUpdatedTimestamp(ctx context.Context, memoID int32) error {
	updatedTs := time.Now().Unix()
	if err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{
		ID:        memoID,
		UpdatedTs: &updatedTs,
	}); err != nil {
		return status.Errorf(codes.Internal, "failed to update memo timestamp")
	}
	return nil
}

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
		parentMemo, _ = s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
	}

	return memo, parentMemo, memoMessage, nil
}

func (s *APIV1Service) dispatchMemoUpdatedSideEffects(ctx context.Context, memo *store.Memo, parentMemo *store.Memo, memoMessage *v1pb.Memo) {
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo updated webhook", slog.Any("err", err))
	}

	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoUpdated,
		Name:       memoMessage.Name,
		Parent:     memoMessage.GetParent(),
		Visibility: memo.Visibility,
		CreatorID:  resolveSSECreatorID(memo, parentMemo),
	})
}

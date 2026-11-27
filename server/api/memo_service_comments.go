package api

import (
	"context"
	"log/slog"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// resolveMemoCommentParent loads the memo a new comment names as its parent
// and checks that the caller may comment on it: the parent must be readable by
// the caller and not archived.
func (s *APIService) resolveMemoCommentParent(ctx context.Context, parentName string) (*store.Memo, error) {
	parentUID, err := ExtractMemoUIDFromName(parentName)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent memo name: %v", err)
	}
	parent, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &parentUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if parent == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if err := s.checkMemoReadAccess(ctx, parent); err != nil {
		return nil, err
	}
	if parent.RowStatus != store.Normal {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot comment on an archived memo")
	}
	return parent, nil
}

// createMemoCommentNotification records the comment in the related memo
// creator's inbox. The comment itself is already persisted, so a failure here
// only loses the notification and is logged instead of failing the request;
// failing it would make clients retry and create a duplicate comment.
func (s *APIService) createMemoCommentNotification(ctx context.Context, creatorID int32, memo *store.Memo, relatedMemo *store.Memo) {
	if creatorID == relatedMemo.CreatorID {
		return
	}
	relatedCreator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &relatedMemo.CreatorID})
	if err != nil {
		slog.Warn("Failed to get related memo creator for comment notification",
			slog.Any("err", err),
			slog.Int64("memo_id", int64(memo.ID)))
		return
	}
	if !s.canUserAccessMentionMemos(ctx, relatedCreator, memo, relatedMemo) {
		return
	}
	if _, err := s.createInboxWithEmailNotification(ctx, &store.Inbox{
		SenderID:   creatorID,
		ReceiverID: relatedMemo.CreatorID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type: storepb.InboxMessage_MEMO_COMMENT,
			Payload: &storepb.InboxMessage_MemoComment{
				MemoComment: &storepb.InboxMessage_MemoCommentPayload{
					MemoId:        memo.ID,
					RelatedMemoId: relatedMemo.ID,
				},
			},
		},
	}); err != nil {
		slog.Warn("Failed to create memo comment notification",
			slog.Any("err", err),
			slog.Int64("memo_id", int64(memo.ID)),
			slog.Int64("receiver_id", int64(relatedMemo.CreatorID)))
	}
}

// batchCountMemoComments returns, for each of the memos that has any, the
// number of active comments directly on it that the caller can read. Each
// comment is authorized by its own audience, the same rule a comment listing
// applies.
func (s *APIService) batchCountMemoComments(ctx context.Context, memos []*store.Memo) (map[int32]int32, error) {
	counts := make(map[int32]int32)
	if len(memos) == 0 {
		return counts, nil
	}
	memoIDs := make([]int32, 0, len(memos))
	for _, memo := range memos {
		memoIDs = append(memoIDs, memo.ID)
	}
	commentType := store.MemoRelationComment
	relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoIDList: memoIDs,
		Type:              &commentType,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list comment relations")
	}
	if len(relations) == 0 {
		return counts, nil
	}

	commentIDs := make([]int32, 0, len(relations))
	for _, relation := range relations {
		commentIDs = append(commentIDs, relation.MemoID)
	}
	accessScope, _, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, err
	}
	normal := store.Normal
	comments, err := s.Store.ListMemos(ctx, &store.FindMemo{
		IDList:         commentIDs,
		RowStatus:      &normal,
		ExcludeContent: true,
		Access:         accessScope,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list comment memos")
	}
	readable := make(map[int32]struct{}, len(comments))
	for _, comment := range comments {
		readable[comment.ID] = struct{}{}
	}
	for _, relation := range relations {
		if _, ok := readable[relation.MemoID]; ok {
			counts[relation.RelatedMemoID]++
		}
	}
	return counts, nil
}

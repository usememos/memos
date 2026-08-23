package v1

import (
	"context"
	stderrors "errors"
	"log/slog"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// CreateMemoComment creates a comment on an existing memo.
func (s *APIV1Service) CreateMemoComment(ctx context.Context, request *v1pb.CreateMemoCommentRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if relatedMemo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	// Check memo visibility before allowing comment.
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if err := s.checkMemoReadAccess(ctx, relatedMemo); err != nil {
		return nil, err
	}
	if relatedMemo.RowStatus != store.Normal {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot comment on an archived memo")
	}
	if request.Comment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "comment is required")
	}

	memoUID, err = ValidateAndGenerateUID(request.CommentId)
	if err != nil {
		return nil, err
	}
	if memoUID == relatedMemo.UID {
		return nil, status.Error(codes.InvalidArgument, "a memo cannot comment on itself")
	}
	prepared, err := s.prepareMemoCreate(ctx, user, request.Comment, memoUID)
	if err != nil {
		return nil, err
	}
	if err := s.createMemoWithMutation(ctx, user, prepared.memo, &relatedMemo.ID, prepared.attachments, prepared.requiredAttachmentIDs, prepared.referenceRelations); err != nil {
		return nil, mapMemoCreateError(err, memoUID, "failed to create memo comment")
	}
	memo := prepared.memo
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load memo comment attachments")
	}
	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load memo relations")
	}
	memoComment, err := s.convertMemoFromStore(ctx, memo, nil, attachments, relations)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert memo comment")
	}

	creatorID := user.ID
	relatedCreator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &relatedMemo.CreatorID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get related memo creator")
	}
	if creatorID != relatedMemo.CreatorID &&
		s.canUserAccessMentionMemos(ctx, relatedCreator, memo, relatedMemo) {
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
			return nil, status.Errorf(codes.Internal, "failed to create inbox")
		}
	}

	if err := s.DispatchMemoCommentCreatedWebhook(ctx, memo, relatedMemo, relatedMemo.CreatorID); err != nil {
		slog.Warn("Failed to dispatch memo comment created webhook", slog.Any("err", err))
	}

	s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, relatedMemo, "")

	s.SSEHub.publishMemoChanged()

	return memoComment, nil
}

func (s *APIV1Service) ListMemoComments(ctx context.Context, request *v1pb.ListMemoCommentsRequest) (*v1pb.ListMemoCommentsResponse, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if err := s.checkMemoReadAccess(ctx, memo); err != nil {
		return nil, err
	}
	accessScope, _, err := s.resolveMemoAccessScope(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "%v", err)
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(pageToken.Limit)
		offset = max(int(pageToken.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}
	limitPlusOne := limit + 1
	normal := store.Normal
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
		CommentContextMemoID: &memo.ID,
		RowStatus:            &normal,
		Access:               accessScope,
		Limit:                &limitPlusOne,
		Offset:               &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo comments")
	}

	nextPageToken := ""
	if len(memos) == limitPlusOne {
		memos = memos[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memos) == 0 {
		response := &v1pb.ListMemoCommentsResponse{
			Memos:         []*v1pb.Memo{},
			NextPageToken: nextPageToken,
		}
		return response, nil
	}

	memoIDs := make([]int32, 0, len(memos))

	for _, memo := range memos {
		memoIDs = append(memoIDs, memo.ID)
	}
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	memoReactionsMap := make(map[int32][]*store.Reaction)
	for _, reaction := range reactions {
		memoReactionsMap[reaction.MemoID] = append(memoReactionsMap[reaction.MemoID], reaction)
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	attachmentMap := make(map[int32][]*store.Attachment)
	for _, attachment := range attachments {
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}

	// RELATIONS (batch load to avoid N+1)
	relationMap, err := s.batchConvertMemoRelations(ctx, memos, false)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to batch load memo relations")
	}
	creatorIDs := make([]int32, 0, len(memos)+len(reactions))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorMap, err := s.listUsersByID(ctx, creatorIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo creators: %v", err)
	}
	var memosResponse []*v1pb.Memo
	for _, m := range memos {
		reactions := memoReactionsMap[m.ID]
		attachments := attachmentMap[m.ID]
		relations := relationMap[m.ID]

		memoMessage, err := s.convertMemoFromStoreWithCreators(ctx, m, reactions, attachments, relations, creatorMap)
		if err != nil {
			if stderrors.Is(err, errMemoCreatorNotFound) {
				slog.Warn("Skipping memo comment with missing creator",
					slog.Int64("memo_id", int64(m.ID)),
					slog.String("memo_uid", m.UID),
					slog.Int64("creator_id", int64(m.CreatorID)),
					slog.String("parent_name", request.Name),
				)
				continue
			}
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		memosResponse = append(memosResponse, memoMessage)
	}

	response := &v1pb.ListMemoCommentsResponse{
		Memos:         memosResponse,
		NextPageToken: nextPageToken,
	}
	return response, nil
}

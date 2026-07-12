package v1

import (
	"context"
	stderrors "errors"
	"fmt"
	"log/slog"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

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
	if relatedMemo.Visibility == store.Private && relatedMemo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.Comment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "comment is required")
	}

	comment, ok := proto.Clone(request.Comment).(*v1pb.Memo)
	if !ok {
		return nil, status.Errorf(codes.Internal, "failed to clone memo comment")
	}
	comment.Visibility = convertVisibilityFromStore(relatedMemo.Visibility)

	// Create the memo comment first; suppress the generic memo.created SSE event
	// since CreateMemoComment broadcasts memo.comment.created for the parent instead.
	memoComment, err := s.CreateMemo(withSuppressMentionNotifications(withSuppressSSE(ctx)), &v1pb.CreateMemoRequest{
		Memo:   comment,
		MemoId: request.CommentId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo")
	}
	memoUID, err = ExtractMemoUIDFromName(memoComment.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}

	// Build the relation between the comment memo and the original memo.
	_, err = s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo.ID,
		RelatedMemoID: relatedMemo.ID,
		Type:          store.MemoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo relation")
	}

	// The comment memo was converted before the relation above existed, so its
	// Relations slice is empty. Reload the relations now so that both the API
	// response and the memo.comment.created webhook payload carry the relation
	// to the parent memo.
	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load memo relations")
	}
	memoComment.Relations = relations

	creator, err := ResolveUserByName(ctx, s.Store, memoComment.Creator)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo creator")
	}
	if creator == nil {
		return nil, status.Errorf(codes.NotFound, "memo creator not found")
	}
	creatorID := creator.ID
	if memoComment.Visibility != v1pb.Visibility_PRIVATE && creatorID != relatedMemo.CreatorID {
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

	if err := s.DispatchMemoCommentCreatedWebhook(ctx, memoComment, relatedMemo.CreatorID); err != nil {
		slog.Warn("Failed to dispatch memo comment created webhook", slog.Any("err", err))
	}

	s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, relatedMemo, "")

	// Broadcast live refresh event for the parent memo so subscribers see the new comment.
	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoCommentCreated,
		Name:       request.Name,
		Visibility: relatedMemo.Visibility,
		CreatorID:  relatedMemo.CreatorID,
	})

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

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	var memoFilter string
	if currentUser == nil {
		memoFilter = `visibility == "PUBLIC"`
	} else {
		memoFilter = fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID)
	}
	memoRelationComment := store.MemoRelationComment
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
	memoRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
		Type:          &memoRelationComment,
		MemoFilter:    &memoFilter,
		Limit:         &limitPlusOne,
		Offset:        &offset,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations")
	}

	nextPageToken := ""
	if len(memoRelations) == limitPlusOne {
		memoRelations = memoRelations[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memoRelations) == 0 {
		response := &v1pb.ListMemoCommentsResponse{
			Memos:         []*v1pb.Memo{},
			NextPageToken: nextPageToken,
		}
		return response, nil
	}

	memoRelationIDs := make([]int32, 0, len(memoRelations))
	for _, m := range memoRelations {
		memoRelationIDs = append(memoRelationIDs, m.MemoID)
	}
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{IDList: memoRelationIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos")
	}

	memoIDToNameMap := make(map[int32]string)
	contentIDs := make([]string, 0, len(memos))
	memoIDsForAttachments := make([]int32, 0, len(memos))

	for _, memo := range memos {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
		memoIDToNameMap[memo.ID] = memoName
		contentIDs = append(contentIDs, memoName)
		memoIDsForAttachments = append(memoIDsForAttachments, memo.ID)
	}
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{ContentIDList: contentIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	memoReactionsMap := make(map[string][]*store.Reaction)
	for _, reaction := range reactions {
		memoReactionsMap[reaction.ContentID] = append(memoReactionsMap[reaction.ContentID], reaction)
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDsForAttachments})
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
		memoName := memoIDToNameMap[m.ID]
		reactions := memoReactionsMap[memoName]
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

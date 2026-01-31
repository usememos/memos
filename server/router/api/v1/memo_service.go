package v1

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/plugin/webhook"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateMemo(ctx context.Context, request *v1pb.CreateMemoRequest) (*v1pb.Memo, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Use custom memo_id if provided, otherwise generate a new UUID
	memoUID := strings.TrimSpace(request.MemoId)
	if memoUID == "" {
		memoUID = shortuuid.New()
	} else if !base.UIDMatcher.MatchString(memoUID) {
		// Validate custom memo ID format
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo_id format: must be 1-32 characters, alphanumeric and hyphens only, cannot start or end with hyphen")
	}

	create := &store.Memo{
		UID:        memoUID,
		CreatorID:  user.ID,
		Content:    request.Memo.Content,
		Visibility: convertVisibilityToStore(request.Memo.Visibility),
	}

	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance memo related setting")
	}

	// Handle display_time first: if provided, use it to set the appropriate timestamp
	// based on the instance setting (similar to UpdateMemo logic)
	// Note: explicit create_time/update_time below will override this if provided
	if request.Memo.DisplayTime != nil && request.Memo.DisplayTime.IsValid() {
		displayTs := request.Memo.DisplayTime.AsTime().Unix()
		if instanceMemoRelatedSetting.DisplayWithUpdateTime {
			create.UpdatedTs = displayTs
		} else {
			create.CreatedTs = displayTs
		}
	}

	// Set custom timestamps if provided in the request
	// These take precedence over display_time
	if request.Memo.CreateTime != nil && request.Memo.CreateTime.IsValid() {
		createdTs := request.Memo.CreateTime.AsTime().Unix()
		create.CreatedTs = createdTs
	}
	if request.Memo.UpdateTime != nil && request.Memo.UpdateTime.IsValid() {
		updatedTs := request.Memo.UpdateTime.AsTime().Unix()
		create.UpdatedTs = updatedTs
	}

	if instanceMemoRelatedSetting.DisallowPublicVisibility && create.Visibility == store.Public {
		return nil, status.Errorf(codes.PermissionDenied, "disable public memos system setting is enabled")
	}
	contentLengthLimit, err := s.getContentLengthLimit(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get content length limit")
	}
	if len(create.Content) > contentLengthLimit {
		return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
	}
	if err := memopayload.RebuildMemoPayload(create, s.MarkdownService); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
	}
	if request.Memo.Location != nil {
		create.Payload.Location = convertLocationToStore(request.Memo.Location)
	}

	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		// Check for unique constraint violation (AIP-133 compliance)
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "memo with ID %q already exists", memoUID)
		}
		return nil, err
	}

	attachments := []*store.Attachment{}

	if len(request.Memo.Attachments) > 0 {
		_, err := s.SetMemoAttachments(ctx, &v1pb.SetMemoAttachmentsRequest{
			Name:        fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID),
			Attachments: request.Memo.Attachments,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to set memo attachments")
		}

		a, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
			MemoID: &memo.ID,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to get memo attachments")
		}
		attachments = a
	}
	if len(request.Memo.Relations) > 0 {
		_, err := s.SetMemoRelations(ctx, &v1pb.SetMemoRelationsRequest{
			Name:      fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID),
			Relations: request.Memo.Relations,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to set memo relations")
		}
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo, nil, attachments)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo created webhook", slog.Any("err", err))
	}

	return memoMessage, nil
}

func (s *APIV1Service) ListMemos(ctx context.Context, request *v1pb.ListMemosRequest) (*v1pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
	}
	if request.State == v1pb.State_ARCHIVED {
		state := store.Archived
		memoFind.RowStatus = &state
	} else {
		state := store.Normal
		memoFind.RowStatus = &state
	}

	// Parse order_by field (replaces the old sort and direction fields)
	if request.OrderBy != "" {
		if err := s.parseMemoOrderBy(request.OrderBy, memoFind); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid order_by: %v", err)
		}
	} else {
		// Default ordering by display_time desc
		memoFind.OrderByTimeAsc = false
	}

	if request.Filter != "" {
		if err := s.validateFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		if memoFind.CreatorID == nil {
			filter := fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID)
			memoFind.Filters = append(memoFind.Filters, filter)
		} else if *memoFind.CreatorID != currentUser.ID {
			memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
		}
	}

	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance memo related setting")
	}
	if instanceMemoRelatedSetting.DisplayWithUpdateTime {
		memoFind.OrderByUpdatedTs = true
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	limitPlusOne := limit + 1
	memoFind.Limit = &limitPlusOne
	memoFind.Offset = &offset
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	memoMessages := []*v1pb.Memo{}
	nextPageToken := ""
	if len(memos) == limitPlusOne {
		memos = memos[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memos) == 0 {
		response := &v1pb.ListMemosResponse{
			Memos:         memoMessages,
			NextPageToken: nextPageToken,
		}
		return response, nil
	}

	reactionMap := make(map[string][]*store.Reaction)
	contentIDs := make([]string, 0, len(memos))

	attachmentMap := make(map[int32][]*store.Attachment)
	memoIDs := make([]int32, 0, len(memos))

	for _, m := range memos {
		contentIDs = append(contentIDs, fmt.Sprintf("%s%s", MemoNamePrefix, m.UID))
		memoIDs = append(memoIDs, m.ID)
	}

	// REACTIONS
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{ContentIDList: contentIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}
	for _, reaction := range reactions {
		reactionMap[reaction.ContentID] = append(reactionMap[reaction.ContentID], reaction)
	}

	// ATTACHMENTS
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	for _, attachment := range attachments {
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}

	for _, memo := range memos {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID)
		reactions := reactionMap[memoName]
		attachments := attachmentMap[memo.ID]

		memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert memo")
		}

		memoMessages = append(memoMessages, memoMessage)
	}

	response := &v1pb.ListMemosResponse{
		Memos:         memoMessages,
		NextPageToken: nextPageToken,
	}
	return response, nil
}

func (s *APIV1Service) GetMemo(ctx context.Context, request *v1pb.GetMemoRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.Visibility != store.Public {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user")
		}
		if user == nil {
			return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		if memo.Visibility == store.Private && memo.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	return memoMessage, nil
}

func (s *APIV1Service) UpdateMemo(ctx context.Context, request *v1pb.UpdateMemoRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Memo.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Only the creator or admin can update the memo.
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateMemo{
		ID: memo.ID,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			contentLengthLimit, err := s.getContentLengthLimit(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get content length limit")
			}
			if len(request.Memo.Content) > contentLengthLimit {
				return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
			}
			memo.Content = request.Memo.Content
			if err := memopayload.RebuildMemoPayload(memo, s.MarkdownService); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
			}
			update.Content = &memo.Content
			update.Payload = memo.Payload
		} else if path == "visibility" {
			instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get instance memo related setting")
			}
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			if instanceMemoRelatedSetting.DisallowPublicVisibility && visibility == store.Public {
				return nil, status.Errorf(codes.PermissionDenied, "disable public memos system setting is enabled")
			}
			update.Visibility = &visibility
		} else if path == "pinned" {
			update.Pinned = &request.Memo.Pinned
		} else if path == "state" {
			rowStatus := convertStateToStore(request.Memo.State)
			update.RowStatus = &rowStatus
		} else if path == "create_time" {
			createdTs := request.Memo.CreateTime.AsTime().Unix()
			update.CreatedTs = &createdTs
		} else if path == "update_time" {
			updatedTs := time.Now().Unix()
			if request.Memo.UpdateTime != nil {
				updatedTs = request.Memo.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		} else if path == "display_time" {
			displayTs := request.Memo.DisplayTime.AsTime().Unix()
			memoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get instance memo related setting")
			}
			if memoRelatedSetting.DisplayWithUpdateTime {
				update.UpdatedTs = &displayTs
			} else {
				update.CreatedTs = &displayTs
			}
		} else if path == "location" {
			payload := memo.Payload
			payload.Location = convertLocationToStore(request.Memo.Location)
			update.Payload = payload
		} else if path == "attachments" {
			_, err := s.SetMemoAttachments(ctx, &v1pb.SetMemoAttachmentsRequest{
				Name:        request.Memo.Name,
				Attachments: request.Memo.Attachments,
			})
			if err != nil {
				return nil, errors.Wrap(err, "failed to set memo attachments")
			}
		} else if path == "relations" {
			_, err := s.SetMemoRelations(ctx, &v1pb.SetMemoRelationsRequest{
				Name:      request.Memo.Name,
				Relations: request.Memo.Relations,
			})
			if err != nil {
				return nil, errors.Wrap(err, "failed to set memo relations")
			}
		}
	}

	if err = s.Store.UpdateMemo(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update memo")
	}

	memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &request.Memo.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is updated.
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo updated webhook", slog.Any("err", err))
	}

	return memoMessage, nil
}

func (s *APIV1Service) DeleteMemo(ctx context.Context, request *v1pb.DeleteMemoRequest) (*emptypb.Empty, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Only the creator or admin can update the memo.
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		ContentID: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	if memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments); err == nil {
		// Try to dispatch webhook when memo is deleted.
		if err := s.DispatchMemoDeletedWebhook(ctx, memoMessage); err != nil {
			slog.Warn("Failed to dispatch memo deleted webhook", slog.Any("err", err))
		}
	}

	// Delete memo comments first (store.DeleteMemo handles their relations and attachments)
	commentType := store.MemoRelationComment
	relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{RelatedMemoID: &memo.ID, Type: &commentType})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo comments")
	}
	for _, relation := range relations {
		if err := s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: relation.MemoID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete memo comment")
		}
	}

	// Delete the memo (store.DeleteMemo handles relation and attachment cleanup)
	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: memo.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}

	return &emptypb.Empty{}, nil
}

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

	// Create the memo comment first.
	memoComment, err := s.CreateMemo(ctx, &v1pb.CreateMemoRequest{
		Memo:   request.Comment,
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
	creatorID, err := ExtractUserIDFromName(memoComment.Creator)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo creator")
	}
	if memoComment.Visibility != v1pb.Visibility_PRIVATE && creatorID != relatedMemo.CreatorID {
		activity, err := s.Store.CreateActivity(ctx, &store.Activity{
			CreatorID: creatorID,
			Type:      store.ActivityTypeMemoComment,
			Level:     store.ActivityLevelInfo,
			Payload: &storepb.ActivityPayload{
				MemoComment: &storepb.ActivityMemoCommentPayload{
					MemoId:        memo.ID,
					RelatedMemoId: relatedMemo.ID,
				},
			},
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create activity")
		}
		if _, err := s.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   creatorID,
			ReceiverID: relatedMemo.CreatorID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type:       storepb.InboxMessage_MEMO_COMMENT,
				ActivityId: &activity.ID,
			},
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create inbox")
		}
	}

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
	memoRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
		Type:          &memoRelationComment,
		MemoFilter:    &memoFilter,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations")
	}

	if len(memoRelations) == 0 {
		response := &v1pb.ListMemoCommentsResponse{
			Memos: []*v1pb.Memo{},
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

	var memosResponse []*v1pb.Memo
	for _, m := range memos {
		memoName := memoIDToNameMap[m.ID]
		reactions := memoReactionsMap[memoName]
		attachments := attachmentMap[m.ID]

		memoMessage, err := s.convertMemoFromStore(ctx, m, reactions, attachments)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		memosResponse = append(memosResponse, memoMessage)
	}

	response := &v1pb.ListMemoCommentsResponse{
		Memos: memosResponse,
	}
	return response, nil
}

func (s *APIV1Service) getContentLengthLimit(ctx context.Context) (int, error) {
	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return 0, status.Errorf(codes.Internal, "failed to get instance memo related setting")
	}
	return int(instanceMemoRelatedSetting.ContentLengthLimit), nil
}

// DispatchMemoCreatedWebhook dispatches webhook when memo is created.
func (s *APIV1Service) DispatchMemoCreatedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.created")
}

// DispatchMemoUpdatedWebhook dispatches webhook when memo is updated.
func (s *APIV1Service) DispatchMemoUpdatedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.updated")
}

// DispatchMemoDeletedWebhook dispatches webhook when memo is deleted.
func (s *APIV1Service) DispatchMemoDeletedWebhook(ctx context.Context, memo *v1pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.deleted")
}

func (s *APIV1Service) dispatchMemoRelatedWebhook(ctx context.Context, memo *v1pb.Memo, activityType string) error {
	creatorID, err := ExtractUserIDFromName(memo.Creator)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid memo creator")
	}
	webhooks, err := s.Store.GetUserWebhooks(ctx, creatorID)
	if err != nil {
		return err
	}
	for _, hook := range webhooks {
		payload, err := convertMemoToWebhookPayload(memo)
		if err != nil {
			return errors.Wrap(err, "failed to convert memo to webhook payload")
		}
		payload.ActivityType = activityType
		payload.URL = hook.Url

		// Use asynchronous webhook dispatch
		webhook.PostAsync(payload)
	}
	return nil
}

func convertMemoToWebhookPayload(memo *v1pb.Memo) (*webhook.WebhookRequestPayload, error) {
	creatorID, err := ExtractUserIDFromName(memo.Creator)
	if err != nil {
		return nil, errors.Wrap(err, "invalid memo creator")
	}
	return &webhook.WebhookRequestPayload{
		Creator: fmt.Sprintf("%s%d", UserNamePrefix, creatorID),
		Memo:    memo,
	}, nil
}

func (s *APIV1Service) getMemoContentSnippet(content string) (string, error) {
	// Use goldmark service for snippet generation
	snippet, err := s.MarkdownService.GenerateSnippet([]byte(content), 64)
	if err != nil {
		return "", errors.Wrap(err, "failed to generate snippet")
	}
	return snippet, nil
}

// parseMemoOrderBy parses the order_by field and sets the appropriate ordering in memoFind.
// Follows AIP-132: supports comma-separated list of fields with optional "desc" suffix.
// Example: "pinned desc, display_time desc" or "create_time asc".
func (*APIV1Service) parseMemoOrderBy(orderBy string, memoFind *store.FindMemo) error {
	if strings.TrimSpace(orderBy) == "" {
		return errors.New("empty order_by")
	}

	// Split by comma to support multiple sort fields per AIP-132.
	fields := strings.Split(orderBy, ",")

	// Track if we've seen pinned field.
	hasPinned := false

	for _, field := range fields {
		parts := strings.Fields(strings.TrimSpace(field))
		if len(parts) == 0 {
			continue
		}

		fieldName := parts[0]
		fieldDirection := "desc" // default per AIP-132 (we use desc as default for time fields)
		if len(parts) > 1 {
			fieldDirection = strings.ToLower(parts[1])
			if fieldDirection != "asc" && fieldDirection != "desc" {
				return errors.Errorf("invalid order direction: %s, must be 'asc' or 'desc'", parts[1])
			}
		}

		switch fieldName {
		case "pinned":
			hasPinned = true
			memoFind.OrderByPinned = true
			// Note: pinned is always DESC (true first) regardless of direction specified.
		case "display_time", "create_time", "name":
			// Only set if this is the first time field we encounter.
			if !memoFind.OrderByUpdatedTs {
				memoFind.OrderByTimeAsc = fieldDirection == "asc"
			}
		case "update_time":
			memoFind.OrderByUpdatedTs = true
			memoFind.OrderByTimeAsc = fieldDirection == "asc"
		default:
			return errors.Errorf("unsupported order field: %s, supported fields are: pinned, display_time, create_time, update_time, name", fieldName)
		}
	}

	// If only pinned was specified, still need to set a default time ordering.
	if hasPinned && !memoFind.OrderByUpdatedTs && len(fields) == 1 {
		memoFind.OrderByTimeAsc = false // default to desc
	}

	return nil
}

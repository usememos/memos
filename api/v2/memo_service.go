package v2

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/plugin/gomark/ast"
	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	"github.com/usememos/memos/plugin/gomark/restore"
	"github.com/usememos/memos/plugin/webhook"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/service/metric"
	"github.com/usememos/memos/store"
)

const (
	MaxContentLength = 8 * 1024
)

func (s *APIV2Service) CreateMemo(ctx context.Context, request *apiv2pb.CreateMemoRequest) (*apiv2pb.CreateMemoResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if len(request.Content) > MaxContentLength {
		return nil, status.Errorf(codes.InvalidArgument, "content too long")
	}

	nodes, err := parser.Parse(tokenizer.Tokenize(request.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}

	create := &store.Memo{
		CreatorID:  user.ID,
		Content:    request.Content,
		Visibility: store.Visibility(request.Visibility.String()),
	}
	// Find disable public memos system setting.
	disablePublicMemosSystem, err := s.getDisablePublicMemosSystemSettingValue(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get system setting")
	}
	if disablePublicMemosSystem && create.Visibility == store.Public {
		return nil, status.Errorf(codes.PermissionDenied, "disable public memos system setting is enabled")
	}

	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		return nil, err
	}
	metric.Enqueue("memo create")

	// Dynamically upsert tags from memo content.
	traverseASTNodes(nodes, func(node ast.Node) {
		if tag, ok := node.(*ast.Tag); ok {
			if _, err := s.Store.UpsertTag(ctx, &store.Tag{
				Name:      tag.Content,
				CreatorID: user.ID,
			}); err != nil {
				log.Warn("Failed to create tag", zap.Error(err))
			}
		}
	})

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, memoMessage); err != nil {
		log.Warn("Failed to dispatch memo created webhook", zap.Error(err))
	}

	response := &apiv2pb.CreateMemoResponse{
		Memo: memoMessage,
	}
	return response, nil
}

func (s *APIV2Service) ListMemos(ctx context.Context, request *apiv2pb.ListMemosRequest) (*apiv2pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
	}
	if request.Filter != "" {
		filter, err := parseListMemosFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if len(filter.ContentSearch) > 0 {
			memoFind.ContentSearch = filter.ContentSearch
		}
		if len(filter.Visibilities) > 0 {
			memoFind.VisibilityList = filter.Visibilities
		}
		if filter.OrderByPinned {
			memoFind.OrderByPinned = filter.OrderByPinned
		}
		if filter.DisplayTimeAfter != nil {
			displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
			}
			if displayWithUpdatedTs {
				memoFind.UpdatedTsAfter = filter.DisplayTimeAfter
			} else {
				memoFind.CreatedTsAfter = filter.DisplayTimeAfter
			}
		}
		if filter.DisplayTimeBefore != nil {
			displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
			}
			if displayWithUpdatedTs {
				memoFind.UpdatedTsBefore = filter.DisplayTimeBefore
			} else {
				memoFind.CreatedTsBefore = filter.DisplayTimeBefore
			}
		}
		if filter.Creator != nil {
			username, err := ExtractUsernameFromName(*filter.Creator)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid creator name")
			}
			user, err := s.Store.GetUser(ctx, &store.FindUser{
				Username: &username,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get user")
			}
			if user == nil {
				return nil, status.Errorf(codes.NotFound, "user not found")
			}
			memoFind.CreatorID = &user.ID
		}
		if filter.RowStatus != nil {
			memoFind.RowStatus = filter.RowStatus
		}
	} else {
		return nil, status.Errorf(codes.InvalidArgument, "filter is required")
	}

	user, _ := getCurrentUser(ctx, s.Store)
	// If the user is not authenticated, only public memos are visible.
	if user == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	}
	if user != nil && memoFind.CreatorID != nil && *memoFind.CreatorID != user.ID {
		memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
	}
	if displayWithUpdatedTs {
		memoFind.OrderByUpdatedTs = true
	}

	if request.Limit != 0 {
		offset, limit := int(request.Offset), int(request.Limit)
		memoFind.Offset = &offset
		memoFind.Limit = &limit
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, err
	}

	memoMessages := make([]*apiv2pb.Memo, len(memos))
	for i, memo := range memos {
		memoMessage, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		memoMessages[i] = memoMessage
	}

	response := &apiv2pb.ListMemosResponse{
		Memos: memoMessages,
	}
	return response, nil
}

func (s *APIV2Service) GetMemo(ctx context.Context, request *apiv2pb.GetMemoRequest) (*apiv2pb.GetMemoResponse, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.Visibility != store.Public {
		user, err := getCurrentUser(ctx, s.Store)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user")
		}
		if user == nil {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		if memo.Visibility == store.Private && memo.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	response := &apiv2pb.GetMemoResponse{
		Memo: memoMessage,
	}
	return response, nil
}

func (s *APIV2Service) UpdateMemo(ctx context.Context, request *apiv2pb.UpdateMemoRequest) (*apiv2pb.UpdateMemoResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, _ := getCurrentUser(ctx, s.Store)
	if memo.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateMemo{
		ID:        request.Id,
		UpdatedTs: &currentTs,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			update.Content = &request.Memo.Content
			nodes, err := parser.Parse(tokenizer.Tokenize(*update.Content))
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse memo content")
			}

			// Dynamically upsert tags from memo content.
			traverseASTNodes(nodes, func(node ast.Node) {
				if tag, ok := node.(*ast.Tag); ok {
					if _, err := s.Store.UpsertTag(ctx, &store.Tag{
						Name:      tag.Content,
						CreatorID: user.ID,
					}); err != nil {
						log.Warn("Failed to create tag", zap.Error(err))
					}
				}
			})
		} else if path == "nodes" {
			nodes := convertToASTNodes(request.Memo.Nodes)
			content := restore.Restore(nodes)
			update.Content = &content
		} else if path == "visibility" {
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			update.Visibility = &visibility
		} else if path == "row_status" {
			rowStatus := convertRowStatusToStore(request.Memo.RowStatus)
			println("rowStatus", rowStatus)
			update.RowStatus = &rowStatus
		} else if path == "created_ts" {
			createdTs := request.Memo.CreateTime.AsTime().Unix()
			update.CreatedTs = &createdTs
		} else if path == "pinned" {
			if _, err := s.Store.UpsertMemoOrganizer(ctx, &store.MemoOrganizer{
				MemoID: request.Id,
				UserID: user.ID,
				Pinned: request.Memo.Pinned,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert memo organizer")
			}
		}
	}
	if update.Content != nil && len(*update.Content) > MaxContentLength {
		return nil, status.Errorf(codes.InvalidArgument, "content too long")
	}

	if err = s.Store.UpdateMemo(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update memo")
	}

	memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is updated.
	if err := s.DispatchMemoUpdatedWebhook(ctx, memoMessage); err != nil {
		log.Warn("Failed to dispatch memo updated webhook", zap.Error(err))
	}

	return &apiv2pb.UpdateMemoResponse{
		Memo: memoMessage,
	}, nil
}

func (s *APIV2Service) DeleteMemo(ctx context.Context, request *apiv2pb.DeleteMemoRequest) (*apiv2pb.DeleteMemoResponse, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, _ := getCurrentUser(ctx, s.Store)
	if memo.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if memoMessage, err := s.convertMemoFromStore(ctx, memo); err == nil {
		// Try to dispatch webhook when memo is deleted.
		if err := s.DispatchMemoDeletedWebhook(ctx, memoMessage); err != nil {
			log.Warn("Failed to dispatch memo deleted webhook", zap.Error(err))
		}
	}

	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{
		ID: request.Id,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}

	return &apiv2pb.DeleteMemoResponse{}, nil
}

func (s *APIV2Service) CreateMemoComment(ctx context.Context, request *apiv2pb.CreateMemoCommentRequest) (*apiv2pb.CreateMemoCommentResponse, error) {
	relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &request.Id})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}

	// Create the comment memo first.
	createMemoResponse, err := s.CreateMemo(ctx, request.Create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo")
	}

	// Build the relation between the comment memo and the original memo.
	memo := createMemoResponse.Memo
	_, err = s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo.Id,
		RelatedMemoID: request.Id,
		Type:          store.MemoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo relation")
	}
	if memo.Visibility != apiv2pb.Visibility_PRIVATE && memo.CreatorId != relatedMemo.CreatorID {
		activity, err := s.Store.CreateActivity(ctx, &store.Activity{
			CreatorID: memo.CreatorId,
			Type:      store.ActivityTypeMemoComment,
			Level:     store.ActivityLevelInfo,
			Payload: &storepb.ActivityPayload{
				MemoComment: &storepb.ActivityMemoCommentPayload{
					MemoId:        memo.Id,
					RelatedMemoId: request.Id,
				},
			},
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create activity")
		}
		if _, err := s.Store.CreateInbox(ctx, &store.Inbox{
			SenderID:   memo.CreatorId,
			ReceiverID: relatedMemo.CreatorID,
			Status:     store.UNREAD,
			Message: &storepb.InboxMessage{
				Type:       storepb.InboxMessage_TYPE_MEMO_COMMENT,
				ActivityId: &activity.ID,
			},
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create inbox")
		}
	}
	metric.Enqueue("memo comment create")

	response := &apiv2pb.CreateMemoCommentResponse{
		Memo: memo,
	}
	return response, nil
}

func (s *APIV2Service) ListMemoComments(ctx context.Context, request *apiv2pb.ListMemoCommentsRequest) (*apiv2pb.ListMemoCommentsResponse, error) {
	memoRelationComment := store.MemoRelationComment
	memoRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &request.Id,
		Type:          &memoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations")
	}

	var memos []*apiv2pb.Memo
	for _, memoRelation := range memoRelations {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoRelation.MemoID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get memo")
		}
		if memo != nil {
			memoMessage, err := s.convertMemoFromStore(ctx, memo)
			if err != nil {
				return nil, errors.Wrap(err, "failed to convert memo")
			}
			memos = append(memos, memoMessage)
		}
	}

	response := &apiv2pb.ListMemoCommentsResponse{
		Memos: memos,
	}
	return response, nil
}

func (s *APIV2Service) GetUserMemosStats(ctx context.Context, request *apiv2pb.GetUserMemosStatsRequest) (*apiv2pb.GetUserMemosStatsResponse, error) {
	username, err := ExtractUsernameFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username")
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	normalRowStatus := store.Normal
	memoFind := &store.FindMemo{
		CreatorID:       &user.ID,
		RowStatus:       &normalRowStatus,
		ExcludeComments: true,
		ExcludeContent:  true,
	}
	displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
	}
	if displayWithUpdatedTs {
		memoFind.OrderByUpdatedTs = true
	}
	if request.Filter != "" {
		filter, err := parseListMemosFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if len(filter.ContentSearch) > 0 {
			memoFind.ContentSearch = filter.ContentSearch
		}
		if len(filter.Visibilities) > 0 {
			memoFind.VisibilityList = filter.Visibilities
		}
		if filter.OrderByPinned {
			memoFind.OrderByPinned = filter.OrderByPinned
		}
		if filter.DisplayTimeAfter != nil {
			displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
			}
			if displayWithUpdatedTs {
				memoFind.UpdatedTsAfter = filter.DisplayTimeAfter
			} else {
				memoFind.CreatedTsAfter = filter.DisplayTimeAfter
			}
		}
		if filter.DisplayTimeBefore != nil {
			displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get memo display with updated ts setting value")
			}
			if displayWithUpdatedTs {
				memoFind.UpdatedTsBefore = filter.DisplayTimeBefore
			} else {
				memoFind.CreatedTsBefore = filter.DisplayTimeBefore
			}
		}
		if filter.RowStatus != nil {
			memoFind.RowStatus = filter.RowStatus
		}
	}

	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos")
	}

	location, err := time.LoadLocation(request.Timezone)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "invalid timezone location")
	}

	stats := make(map[string]int32)
	for _, memo := range memos {
		displayTs := memo.CreatedTs
		if displayWithUpdatedTs {
			displayTs = memo.UpdatedTs
		}
		stats[time.Unix(displayTs, 0).In(location).Format("2006-01-02")]++
	}

	response := &apiv2pb.GetUserMemosStatsResponse{
		Stats: stats,
	}
	return response, nil
}

func (s *APIV2Service) convertMemoFromStore(ctx context.Context, memo *store.Memo) (*apiv2pb.Memo, error) {
	rawNodes, err := parser.Parse(tokenizer.Tokenize(memo.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}
	displayTs := memo.CreatedTs
	if displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx); err == nil && displayWithUpdatedTs {
		displayTs = memo.UpdatedTs
	}

	creator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &memo.CreatorID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get creator")
	}

	listMemoRelationsResponse, err := s.ListMemoRelations(ctx, &apiv2pb.ListMemoRelationsRequest{Id: memo.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo relations")
	}

	listMemoResourcesResponse, err := s.ListMemoResources(ctx, &apiv2pb.ListMemoResourcesRequest{Id: memo.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list memo resources")
	}

	return &apiv2pb.Memo{
		Id:          int32(memo.ID),
		RowStatus:   convertRowStatusFromStore(memo.RowStatus),
		Creator:     fmt.Sprintf("%s%s", UserNamePrefix, creator.Username),
		CreatorId:   int32(memo.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(memo.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(memo.UpdatedTs, 0)),
		DisplayTime: timestamppb.New(time.Unix(displayTs, 0)),
		Content:     memo.Content,
		Nodes:       convertFromASTNodes(rawNodes),
		Visibility:  convertVisibilityFromStore(memo.Visibility),
		Pinned:      memo.Pinned,
		ParentId:    memo.ParentID,
		Relations:   listMemoRelationsResponse.Relations,
		Resources:   listMemoResourcesResponse.Resources,
	}, nil
}

func (s *APIV2Service) getMemoDisplayWithUpdatedTsSettingValue(ctx context.Context) (bool, error) {
	memoDisplayWithUpdatedTsSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingMemoDisplayWithUpdatedTsName.String(),
	})
	if err != nil {
		return false, errors.Wrap(err, "failed to find system setting")
	}
	if memoDisplayWithUpdatedTsSetting == nil {
		return false, nil
	}

	memoDisplayWithUpdatedTs := false
	if err := json.Unmarshal([]byte(memoDisplayWithUpdatedTsSetting.Value), &memoDisplayWithUpdatedTs); err != nil {
		return false, errors.Wrap(err, "failed to unmarshal system setting value")
	}
	return memoDisplayWithUpdatedTs, nil
}

func (s *APIV2Service) getDisablePublicMemosSystemSettingValue(ctx context.Context) (bool, error) {
	disablePublicMemosSystemSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingDisablePublicMemosName.String(),
	})
	if err != nil {
		return false, errors.Wrap(err, "failed to find system setting")
	}
	if disablePublicMemosSystemSetting == nil {
		return false, nil
	}

	disablePublicMemos := false
	if err := json.Unmarshal([]byte(disablePublicMemosSystemSetting.Value), &disablePublicMemos); err != nil {
		return false, errors.Wrap(err, "failed to unmarshal system setting value")
	}
	return disablePublicMemos, nil
}

func convertVisibilityFromStore(visibility store.Visibility) apiv2pb.Visibility {
	switch visibility {
	case store.Private:
		return apiv2pb.Visibility_PRIVATE
	case store.Protected:
		return apiv2pb.Visibility_PROTECTED
	case store.Public:
		return apiv2pb.Visibility_PUBLIC
	default:
		return apiv2pb.Visibility_VISIBILITY_UNSPECIFIED
	}
}

func convertVisibilityToStore(visibility apiv2pb.Visibility) store.Visibility {
	switch visibility {
	case apiv2pb.Visibility_PRIVATE:
		return store.Private
	case apiv2pb.Visibility_PROTECTED:
		return store.Protected
	case apiv2pb.Visibility_PUBLIC:
		return store.Public
	default:
		return store.Private
	}
}

// ListMemosFilterCELAttributes are the CEL attributes for ListMemosFilter.
var ListMemosFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content_search", cel.ListType(cel.StringType)),
	cel.Variable("visibilities", cel.ListType(cel.StringType)),
	cel.Variable("order_by_pinned", cel.BoolType),
	cel.Variable("display_time_before", cel.IntType),
	cel.Variable("display_time_after", cel.IntType),
	cel.Variable("creator", cel.StringType),
	cel.Variable("row_status", cel.StringType),
}

type ListMemosFilter struct {
	ContentSearch     []string
	Visibilities      []store.Visibility
	OrderByPinned     bool
	DisplayTimeBefore *int64
	DisplayTimeAfter  *int64
	Creator           *string
	RowStatus         *store.RowStatus
}

func parseListMemosFilter(expression string) (*ListMemosFilter, error) {
	e, err := cel.NewEnv(ListMemosFilterCELAttributes...)
	if err != nil {
		return nil, err
	}
	ast, issues := e.Compile(expression)
	if issues != nil {
		return nil, errors.Errorf("found issue %v", issues)
	}
	filter := &ListMemosFilter{}
	expr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := expr.GetExpr().GetCallExpr()
	findField(callExpr, filter)
	return filter, nil
}

func findField(callExpr *expr.Expr_Call, filter *ListMemosFilter) {
	if len(callExpr.Args) == 2 {
		idExpr := callExpr.Args[0].GetIdentExpr()
		if idExpr != nil {
			if idExpr.Name == "content_search" {
				contentSearch := []string{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					contentSearch = append(contentSearch, value)
				}
				filter.ContentSearch = contentSearch
			} else if idExpr.Name == "visibilities" {
				visibilities := []store.Visibility{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					visibilities = append(visibilities, store.Visibility(value))
				}
				filter.Visibilities = visibilities
			} else if idExpr.Name == "order_by_pinned" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.OrderByPinned = value
			} else if idExpr.Name == "display_time_before" {
				displayTimeBefore := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeBefore = &displayTimeBefore
			} else if idExpr.Name == "display_time_after" {
				displayTimeAfter := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeAfter = &displayTimeAfter
			} else if idExpr.Name == "creator" {
				creator := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.Creator = &creator
			} else if idExpr.Name == "row_status" {
				rowStatus := store.RowStatus(callExpr.Args[1].GetConstExpr().GetStringValue())
				filter.RowStatus = &rowStatus
			}
			return
		}
	}
	for _, arg := range callExpr.Args {
		callExpr := arg.GetCallExpr()
		if callExpr != nil {
			findField(callExpr, filter)
		}
	}
}

// DispatchMemoCreatedWebhook dispatches webhook when memo is created.
func (s *APIV2Service) DispatchMemoCreatedWebhook(ctx context.Context, memo *apiv2pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.created")
}

// DispatchMemoUpdatedWebhook dispatches webhook when memo is updated.
func (s *APIV2Service) DispatchMemoUpdatedWebhook(ctx context.Context, memo *apiv2pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.updated")
}

// DispatchMemoDeletedWebhook dispatches webhook when memo is deleted.
func (s *APIV2Service) DispatchMemoDeletedWebhook(ctx context.Context, memo *apiv2pb.Memo) error {
	return s.dispatchMemoRelatedWebhook(ctx, memo, "memos.memo.deleted")
}

func (s *APIV2Service) dispatchMemoRelatedWebhook(ctx context.Context, memo *apiv2pb.Memo, activityType string) error {
	webhooks, err := s.Store.ListWebhooks(ctx, &store.FindWebhook{
		CreatorID: &memo.CreatorId,
	})
	if err != nil {
		return err
	}
	metric.Enqueue("webhook dispatch")
	for _, hook := range webhooks {
		payload := convertMemoToWebhookPayload(memo)
		payload.ActivityType = activityType
		payload.URL = hook.Url
		err := webhook.Post(*payload)
		if err != nil {
			return errors.Wrap(err, "failed to post webhook")
		}
	}
	return nil
}

func convertMemoToWebhookPayload(memo *apiv2pb.Memo) *webhook.WebhookPayload {
	return &webhook.WebhookPayload{
		CreatorID: memo.CreatorId,
		CreatedTs: time.Now().Unix(),
		Memo: &webhook.Memo{
			ID:         memo.Id,
			CreatorID:  memo.CreatorId,
			CreatedTs:  memo.CreateTime.Seconds,
			UpdatedTs:  memo.UpdateTime.Seconds,
			Content:    memo.Content,
			Visibility: memo.Visibility.String(),
			Pinned:     memo.Pinned,
			ResourceList: func() []*webhook.Resource {
				resources := []*webhook.Resource{}
				for _, resource := range memo.Resources {
					resources = append(resources, &webhook.Resource{
						ID:           resource.Id,
						Filename:     resource.Filename,
						ExternalLink: resource.ExternalLink,
						Type:         resource.Type,
						Size:         resource.Size,
					})
				}
				return resources
			}(),
			RelationList: func() []*webhook.MemoRelation {
				relations := []*webhook.MemoRelation{}
				for _, relation := range memo.Relations {
					relations = append(relations, &webhook.MemoRelation{
						MemoID:        relation.MemoId,
						RelatedMemoID: relation.RelatedMemoId,
						Type:          relation.Type.String(),
					})
				}
				return relations
			}(),
		},
	}
}

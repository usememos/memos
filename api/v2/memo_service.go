package v2

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateMemo(ctx context.Context, request *apiv2pb.CreateMemoRequest) (*apiv2pb.CreateMemoResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	create := &store.Memo{
		CreatorID:  user.ID,
		Content:    request.Content,
		Visibility: store.Visibility(request.Visibility.String()),
	}
	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		return nil, err
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	response := &apiv2pb.CreateMemoResponse{
		Memo: memoMessage,
	}
	return response, nil
}

func (s *APIV2Service) ListMemos(ctx context.Context, request *apiv2pb.ListMemosRequest) (*apiv2pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{}
	if request.Filter != "" {
		filter, err := parseListMemosFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if filter.Visibility != nil {
			memoFind.VisibilityList = []store.Visibility{*filter.Visibility}
		}
		if filter.CreatedTsBefore != nil {
			memoFind.CreatedTsBefore = filter.CreatedTsBefore
		}
		if filter.CreatedTsAfter != nil {
			memoFind.CreatedTsAfter = filter.CreatedTsAfter
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
	}

	user, _ := getCurrentUser(ctx, s.Store)
	// If the user is not authenticated, only public memos are visible.
	if user == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	}
	if user != nil && memoFind.CreatorID != nil && *memoFind.CreatorID != user.ID {
		memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	if request.PageSize != 0 {
		offset := int(request.Page * request.PageSize)
		limit := int(request.PageSize)
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

	update := &store.UpdateMemo{
		ID: request.Id,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			update.Content = &request.Memo.Content
		} else if path == "visibility" {
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			update.Visibility = &visibility
		} else if path == "row_status" {
			rowStatus := convertRowStatusToStore(request.Memo.RowStatus)
			println("rowStatus", rowStatus)
			update.RowStatus = &rowStatus
		}
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

	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{
		ID: request.Id,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}

	return &apiv2pb.DeleteMemoResponse{}, nil
}

func (s *APIV2Service) CreateMemoComment(ctx context.Context, request *apiv2pb.CreateMemoCommentRequest) (*apiv2pb.CreateMemoCommentResponse, error) {
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

func (s *APIV2Service) convertMemoFromStore(ctx context.Context, memo *store.Memo) (*apiv2pb.Memo, error) {
	rawNodes, err := parser.Parse(tokenizer.Tokenize(memo.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}
	displayTs := memo.CreatedTs
	if displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx); err == nil && displayWithUpdatedTs {
		displayTs = memo.UpdatedTs
	}

	return &apiv2pb.Memo{
		Id:          int32(memo.ID),
		RowStatus:   convertRowStatusFromStore(memo.RowStatus),
		CreateTime:  timestamppb.New(time.Unix(memo.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(memo.UpdatedTs, 0)),
		DisplayTime: timestamppb.New(time.Unix(displayTs, 0)),
		CreatorId:   int32(memo.CreatorID),
		Content:     memo.Content,
		Nodes:       convertFromASTNodes(rawNodes),
		Visibility:  convertVisibilityFromStore(memo.Visibility),
		Pinned:      memo.Pinned,
	}, nil
}

func (s *APIV2Service) getMemoDisplayWithUpdatedTsSettingValue(ctx context.Context) (bool, error) {
	memoDisplayWithUpdatedTsSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingMemoDisplayWithUpdatedTsName.String(),
	})
	if err != nil {
		return false, errors.Wrap(err, "failed to find system setting")
	}
	memoDisplayWithUpdatedTs := false
	if memoDisplayWithUpdatedTsSetting != nil {
		err = json.Unmarshal([]byte(memoDisplayWithUpdatedTsSetting.Value), &memoDisplayWithUpdatedTs)
		if err != nil {
			return false, errors.Wrap(err, "failed to unmarshal system setting value")
		}
	}
	return memoDisplayWithUpdatedTs, nil
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
	cel.Variable("visibility", cel.StringType),
	cel.Variable("created_ts_before", cel.IntType),
	cel.Variable("created_ts_after", cel.IntType),
	cel.Variable("creator", cel.StringType),
	cel.Variable("row_status", cel.StringType),
}

type ListMemosFilter struct {
	Visibility      *store.Visibility
	CreatedTsBefore *int64
	CreatedTsAfter  *int64
	Creator         *string
	RowStatus       *store.RowStatus
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
			if idExpr.Name == "visibility" {
				visibility := store.Visibility(callExpr.Args[1].GetConstExpr().GetStringValue())
				filter.Visibility = &visibility
			}
			if idExpr.Name == "created_ts_before" {
				createdTsBefore := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.CreatedTsBefore = &createdTsBefore
			}
			if idExpr.Name == "created_ts_after" {
				createdTsAfter := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.CreatedTsAfter = &createdTsAfter
			}
			if idExpr.Name == "creator" {
				creator := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.Creator = &creator
			}
			if idExpr.Name == "row_status" {
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

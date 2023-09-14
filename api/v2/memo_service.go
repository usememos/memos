package v2

import (
	"context"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
	v1alpha1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type MemoService struct {
	apiv2pb.UnimplementedMemoServiceServer

	Store *store.Store
}

// NewMemoService creates a new MemoService.
func NewMemoService(store *store.Store) *MemoService {
	return &MemoService{
		Store: store,
	}
}

func (s *MemoService) ListMemos(ctx context.Context, request *apiv2pb.ListMemosRequest) (*apiv2pb.ListMemosResponse, error) {
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
	}
	user, _ := getCurrentUser(ctx, s.Store)
	// If the user is not authenticated, only public memos are visible.
	if user == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
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
		memoMessages[i] = convertMemoFromStore(memo)
	}

	response := &apiv2pb.ListMemosResponse{
		Memos: memoMessages,
	}
	return response, nil
}

func (s *MemoService) GetMemo(ctx context.Context, request *apiv2pb.GetMemoRequest) (*apiv2pb.GetMemoResponse, error) {
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

	response := &apiv2pb.GetMemoResponse{
		Memo: convertMemoFromStore(memo),
	}
	return response, nil
}

// ListMemosFilterCELAttributes are the CEL attributes for ListMemosFilter.
var ListMemosFilterCELAttributes = []cel.EnvOption{
	cel.Variable("visibility", cel.StringType),
	cel.Variable("created_ts_before", cel.IntType),
	cel.Variable("created_ts_after", cel.IntType),
}

type ListMemosFilter struct {
	Visibility      *store.Visibility
	CreatedTsBefore *int64
	CreatedTsAfter  *int64
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
	callExpr := ast.Expr().GetCallExpr()
	findField(callExpr, filter)
	return filter, nil
}

func findField(callExpr *v1alpha1.Expr_Call, filter *ListMemosFilter) {
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

func convertMemoFromStore(memo *store.Memo) *apiv2pb.Memo {
	return &apiv2pb.Memo{
		Id:         int32(memo.ID),
		RowStatus:  convertRowStatusFromStore(memo.RowStatus),
		CreatedTs:  memo.CreatedTs,
		UpdatedTs:  memo.UpdatedTs,
		CreatorId:  int32(memo.CreatorID),
		Content:    memo.Content,
		Visibility: convertVisibilityFromStore(memo.Visibility),
		Pinned:     memo.Pinned,
	}
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

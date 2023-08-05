package v2

import (
	"context"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
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
	if request.PageSize != 0 {
		offset := int(request.Page * request.PageSize)
		limit := int(request.PageSize)
		memoFind.Offset = &offset
		memoFind.Limit = &limit
	}
	if request.Filter != "" {
		visibilityString, err := getVisibilityFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		memoFind.VisibilityList = []store.Visibility{store.Visibility(visibilityString)}
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, err
	}

	memoMessages := make([]*apiv2pb.Memo, len(memos))
	for i, memo := range memos {
		memoMessages[i] = convertMemoFromStore(memo)
	}

	// TODO(steven): Add privalige checks.
	response := &apiv2pb.ListMemosResponse{
		Memos: nil,
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
		userIDPtr := ctx.Value(UserIDContextKey)
		if userIDPtr == nil {
			return nil, status.Errorf(codes.Unauthenticated, "unauthenticated")
		}
		userID := userIDPtr.(int32)
		if memo.Visibility == store.Private && memo.CreatorID != userID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	response := &apiv2pb.GetMemoResponse{
		Memo: convertMemoFromStore(memo),
	}
	return response, nil
}

// getVisibilityFilter will parse the simple filter such as `visibility = "PRIVATE"` to "PRIVATE" .
func getVisibilityFilter(filter string) (string, error) {
	formatInvalidErr := errors.Errorf("invalid filter %q", filter)
	e, err := cel.NewEnv(cel.Variable("visibility", cel.StringType))
	if err != nil {
		return "", err
	}
	ast, issues := e.Compile(filter)
	if issues != nil {
		return "", status.Errorf(codes.InvalidArgument, issues.String())
	}
	expr := ast.Expr()
	if expr == nil {
		return "", formatInvalidErr
	}
	callExpr := expr.GetCallExpr()
	if callExpr == nil {
		return "", formatInvalidErr
	}
	if callExpr.Function != "_==_" {
		return "", formatInvalidErr
	}
	if len(callExpr.Args) != 2 {
		return "", formatInvalidErr
	}
	if callExpr.Args[0].GetIdentExpr() == nil || callExpr.Args[0].GetIdentExpr().Name != "visibility" {
		return "", formatInvalidErr
	}
	constExpr := callExpr.Args[1].GetConstExpr()
	if constExpr == nil {
		return "", formatInvalidErr
	}
	return constExpr.GetStringValue(), nil
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

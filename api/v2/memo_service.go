package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
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
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{})
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

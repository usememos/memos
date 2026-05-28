package v1

import (
	"context"

	"github.com/usememos/memos/store"
)

func (s *APIV1Service) listMemosByID(ctx context.Context, memoIDs []int32) (map[int32]*store.Memo, error) {
	if len(memoIDs) == 0 {
		return map[int32]*store.Memo{}, nil
	}

	uniqueMemoIDs := make([]int32, 0, len(memoIDs))
	seenMemoIDs := make(map[int32]struct{}, len(memoIDs))
	for _, memoID := range memoIDs {
		if _, seen := seenMemoIDs[memoID]; seen {
			continue
		}
		seenMemoIDs[memoID] = struct{}{}
		uniqueMemoIDs = append(uniqueMemoIDs, memoID)
	}

	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{IDList: uniqueMemoIDs})
	if err != nil {
		return nil, err
	}

	memosByID := make(map[int32]*store.Memo, len(memos))
	for _, memo := range memos {
		memosByID[memo.ID] = memo
	}
	return memosByID, nil
}

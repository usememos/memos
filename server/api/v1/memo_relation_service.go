package v1

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// SetMemoRelations is retired. References are derived from the links in a memo's own
// content, so a second writable path would let the two disagree until the next edit.
func (*APIV1Service) SetMemoRelations(_ context.Context, _ *v1pb.SetMemoRelationsRequest) (*emptypb.Empty, error) {
	return nil, status.Error(codes.Unimplemented, "relations are derived from the memo's content; link a memo inline instead")
}

func (s *APIV1Service) ListMemoRelations(ctx context.Context, request *v1pb.ListMemoRelationsRequest) (*v1pb.ListMemoRelationsResponse, error) {
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
	relationMap, err := s.batchConvertMemoRelations(ctx, []*store.Memo{memo}, true)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations: %v", err)
	}
	relationList := relationMap[memo.ID]
	if relationList == nil {
		relationList = []*v1pb.MemoRelation{}
	}
	limit := normalizePageSize(request.PageSize)
	offset := 0
	if request.PageToken != "" {
		var token v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &token); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(token.Limit)
		offset = max(int(token.Offset), 0)
	}
	end := min(offset+limit, len(relationList))
	if offset > len(relationList) {
		offset = len(relationList)
	}
	nextPageToken := ""
	if end < len(relationList) {
		nextPageToken, err = getPageToken(limit, end)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create page token")
		}
	}

	response := &v1pb.ListMemoRelationsResponse{
		Relations:     relationList[offset:end],
		NextPageToken: nextPageToken,
	}
	return response, nil
}

func convertMemoRelationTypeFromStore(relationType store.MemoRelationType) v1pb.MemoRelation_Type {
	switch relationType {
	case store.MemoRelationReference:
		return v1pb.MemoRelation_REFERENCE
	case store.MemoRelationComment:
		return v1pb.MemoRelation_COMMENT
	default:
		return v1pb.MemoRelation_TYPE_UNSPECIFIED
	}
}

func convertMemoRelationTypeToStore(relationType v1pb.MemoRelation_Type) store.MemoRelationType {
	switch relationType {
	case v1pb.MemoRelation_COMMENT:
		return store.MemoRelationComment
	default:
		return store.MemoRelationReference
	}
}

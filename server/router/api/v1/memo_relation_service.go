package v1

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) SetMemoRelations(ctx context.Context, request *v1pb.SetMemoRelationsRequest) (*emptypb.Empty, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
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
	if memo.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	relations, err := s.prepareMemoRelations(ctx, memo, request.Relations)
	if err != nil {
		return nil, err
	}
	updatedTsSec := time.Now().Unix()
	if err := s.applyMemoMutation(ctx, memo, nil, &store.UpdateMemo{ID: memo.ID, UpdatedTs: &updatedTsSec}, nil, &relations); err != nil {
		return nil, err
	}
	_, _, memoMessage, err := s.buildUpdatedMemoState(ctx, memo.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to build updated memo state")
	}
	s.dispatchMemoUpdatedSideEffects(ctx, memoMessage)

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) prepareMemoRelations(ctx context.Context, memo *store.Memo, relations []*v1pb.MemoRelation) ([]*store.MemoRelation, error) {
	prepared := make([]*store.MemoRelation, 0, len(relations))
	seenRelatedMemoIDs := make(map[int32]struct{}, len(relations))
	for _, relation := range relations {
		if relation == nil || relation.RelatedMemo == nil {
			return nil, status.Errorf(codes.InvalidArgument, "related memo is required")
		}
		switch relation.Type {
		case v1pb.MemoRelation_REFERENCE:
			// REFERENCE is the only client-mutable relation type.
		case v1pb.MemoRelation_COMMENT:
			// COMMENT context is immutable and may only be created atomically with a
			// new memo through CreateMemoComment.
			return nil, status.Errorf(codes.InvalidArgument, "COMMENT relations are output only")
		default:
			return nil, status.Errorf(codes.InvalidArgument, "relation type must be REFERENCE")
		}
		// Ignore reflexive relations.
		if buildMemoName(memo.UID) == relation.RelatedMemo.Name {
			continue
		}
		relatedMemoUID, err := ExtractMemoUIDFromName(relation.RelatedMemo.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid related memo name: %v", err)
		}
		relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &relatedMemoUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get related memo")
		}
		if relatedMemo == nil {
			return nil, status.Errorf(codes.NotFound, "related memo not found")
		}
		if err := s.checkMemoReadAccess(ctx, relatedMemo); err != nil {
			return nil, err
		}
		if _, ok := seenRelatedMemoIDs[relatedMemo.ID]; ok {
			continue
		}
		seenRelatedMemoIDs[relatedMemo.ID] = struct{}{}
		prepared = append(prepared, &store.MemoRelation{
			MemoID:        memo.ID,
			RelatedMemoID: relatedMemo.ID,
			Type:          convertMemoRelationTypeToStore(relation.Type),
		})
	}
	return prepared, nil
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

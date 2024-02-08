package v2

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/ent"
	"github.com/usememos/memos/ent/memorelation"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) SetMemoRelations(ctx context.Context, request *apiv2pb.SetMemoRelationsRequest) (*apiv2pb.SetMemoRelationsResponse, error) {
	referenceType := store.MemoRelationReference
	// Delete all reference relations first.
	if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &request.Id,
		Type:   &referenceType,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo relation")
	}

	for _, relation := range request.Relations {
		// Ignore reflexive relations.
		if request.Id == relation.RelatedMemoId {
			continue
		}
		// Ignore comment relations as there's no need to update a comment's relation.
		// Inserting/Deleting a comment is handled elsewhere.
		if relation.Type == apiv2pb.MemoRelation_COMMENT {
			continue
		}
		if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        request.Id,
			RelatedMemoID: relation.RelatedMemoId,
			Type:          convertMemoRelationTypeToStore(relation.Type),
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to upsert memo relation")
		}
	}

	return &apiv2pb.SetMemoRelationsResponse{}, nil
}

func (s *APIV2Service) ListMemoRelations(ctx context.Context, request *apiv2pb.ListMemoRelationsRequest) (*apiv2pb.ListMemoRelationsResponse, error) {
	relationList := []*apiv2pb.MemoRelation{}
	tempList, err := s.Store.V2.MemoRelation.
		Query().
		Where(memorelation.MemoID(int(request.Id))).
		All(ctx)
	if err != nil {
		return nil, err
	}

	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStoreV2(relation))
	}
	tempList, err = s.Store.V2.MemoRelation.
		Query().
		Where(memorelation.RelatedMemoID(int(request.Id))).
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStoreV2(relation))
	}

	response := &apiv2pb.ListMemoRelationsResponse{
		Relations: relationList,
	}
	return response, nil
}

func convertMemoRelationFromStoreV2(memoRelation *ent.MemoRelation) *apiv2pb.MemoRelation {
	return &apiv2pb.MemoRelation{
		MemoId:        int32(memoRelation.MemoID),
		RelatedMemoId: int32(memoRelation.RelatedMemoID),
		Type:          convertMemoRelationTypeFromStore(store.MemoRelationType(memoRelation.Type)),
	}
}

func convertMemoRelationTypeFromStore(relationType store.MemoRelationType) apiv2pb.MemoRelation_Type {
	switch relationType {
	case store.MemoRelationReference:
		return apiv2pb.MemoRelation_REFERENCE
	case store.MemoRelationComment:
		return apiv2pb.MemoRelation_COMMENT
	default:
		return apiv2pb.MemoRelation_TYPE_UNSPECIFIED
	}
}

func convertMemoRelationTypeToStore(relationType apiv2pb.MemoRelation_Type) store.MemoRelationType {
	switch relationType {
	case apiv2pb.MemoRelation_REFERENCE:
		return store.MemoRelationReference
	case apiv2pb.MemoRelation_COMMENT:
		return store.MemoRelationComment
	default:
		return store.MemoRelationReference
	}
}

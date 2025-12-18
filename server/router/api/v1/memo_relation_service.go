package v1

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
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
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	referenceType := store.MemoRelationReference
	// Delete all reference relations first.
	if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &memo.ID,
		Type:   &referenceType,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo relation")
	}

	for _, relation := range request.Relations {
		// Ignore reflexive relations.
		if request.Name == relation.RelatedMemo.Name {
			continue
		}
		// Ignore comment relations as there's no need to update a comment's relation.
		// Inserting/Deleting a comment is handled elsewhere.
		if relation.Type == v1pb.MemoRelation_COMMENT {
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
		if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        memo.ID,
			RelatedMemoID: relatedMemo.ID,
			Type:          convertMemoRelationTypeToStore(relation.Type),
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to upsert memo relation")
		}
	}

	return &emptypb.Empty{}, nil
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
	relationList := []*v1pb.MemoRelation{}
	tempList, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID:     &memo.ID,
		MemoFilter: &memoFilter,
	})
	if err != nil {
		return nil, err
	}
	for _, raw := range tempList {
		relation, err := s.convertMemoRelationFromStore(ctx, raw)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert memo relation")
		}
		relationList = append(relationList, relation)
	}
	tempList, err = s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &memo.ID,
		MemoFilter:    &memoFilter,
	})
	if err != nil {
		return nil, err
	}
	for _, raw := range tempList {
		relation, err := s.convertMemoRelationFromStore(ctx, raw)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert memo relation")
		}
		relationList = append(relationList, relation)
	}

	response := &v1pb.ListMemoRelationsResponse{
		Relations: relationList,
	}
	return response, nil
}

func (s *APIV1Service) convertMemoRelationFromStore(ctx context.Context, memoRelation *store.MemoRelation) (*v1pb.MemoRelation, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoRelation.MemoID})
	if err != nil {
		return nil, err
	}
	memoSnippet, err := s.getMemoContentSnippet(memo.Content)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo content snippet")
	}
	relatedMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &memoRelation.RelatedMemoID})
	if err != nil {
		return nil, err
	}
	relatedMemoSnippet, err := s.getMemoContentSnippet(relatedMemo.Content)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get related memo content snippet")
	}
	return &v1pb.MemoRelation{
		Memo: &v1pb.MemoRelation_Memo{
			Name:    fmt.Sprintf("%s%s", MemoNamePrefix, memo.UID),
			Snippet: memoSnippet,
		},
		RelatedMemo: &v1pb.MemoRelation_Memo{
			Name:    fmt.Sprintf("%s%s", MemoNamePrefix, relatedMemo.UID),
			Snippet: relatedMemoSnippet,
		},
		Type: convertMemoRelationTypeFromStore(memoRelation.Type),
	}, nil
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

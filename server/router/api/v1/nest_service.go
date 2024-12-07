package v1

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateNest(ctx context.Context, request *v1pb.CreateNestRequest) (*v1pb.Nest, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	create := &store.Nest{
		CreatorID: user.ID,
		Name:      request.Name,
	}

	nest, err := s.Store.CreateNest(ctx, create)
	if err != nil {
		return nil, err
	}

	nestMessage, err := convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}

	return nestMessage, nil
}

func (s *APIV1Service) ListNests(ctx context.Context, _ *v1pb.ListNestsRequest) (*v1pb.ListNestsResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	nestFind := &store.FindNest{
		CreatorID: &user.ID,
	}

	nests, err := s.Store.ListNests(ctx, nestFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list nests: %v", err)
	}

	nestMessages := []*v1pb.Nest{}
	for _, nest := range nests {
		nestMessage, err := convertNestFromStore(nest)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert nest")
		}
		nestMessages = append(nestMessages, nestMessage)
	}

	response := &v1pb.ListNestsResponse{
		Nests: nestMessages,
	}
	return response, nil
}

func (s *APIV1Service) GetNest(ctx context.Context, request *v1pb.GetNestRequest) (*v1pb.Nest, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	id, err := ExtractNestIDFromName(request.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid nest name: %v", err)
	}
	nest, err := s.Store.GetNest(ctx, &store.FindNest{
		CreatorID: &user.ID,
		ID:        &id,
	})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, status.Errorf(codes.NotFound, "nest not found")
	}

	nestMessage, err := convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}
	return nestMessage, nil
}

//nolint:all
func (s *APIV1Service) GetNestByName(ctx context.Context, request *v1pb.GetNestByNameRequest) (*v1pb.Nest, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	nest, err := s.Store.GetNest(ctx, &store.FindNest{
		Name:      &request.Name,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, status.Errorf(codes.NotFound, "nest not found")
	}

	nestMessage, err := convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}
	return nestMessage, nil
}

func (s *APIV1Service) UpdateNest(ctx context.Context, request *v1pb.UpdateNestRequest) (*v1pb.Nest, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	id, err := ExtractNestIDFromName(request.Nest.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid nest name: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	nest, err := s.Store.GetNest(ctx, &store.FindNest{
		ID: &id,
	})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, status.Errorf(codes.NotFound, "nest not found")
	}

	// Only the creator or admin can update the nest.
	if nest.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateNest{
		ID: id,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "name" {
			update.Name = &request.Nest.Name
			if !util.UIDMatcher.MatchString(*update.Name) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid resource name")
			}
		}
	}

	if err = s.Store.UpdateNest(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update nest")
	}

	nest, err = s.Store.GetNest(ctx, &store.FindNest{
		ID: &id,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get nest")
	}
	nestMessage, err := convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}

	return nestMessage, nil
}

func (s *APIV1Service) DeleteNest(ctx context.Context, request *v1pb.DeleteNestRequest) (*emptypb.Empty, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	nestID, err := ExtractNestIDFromName(request.Id)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid nest name: %v", err)
	}
	nest, err := s.Store.GetNest(ctx, &store.FindNest{
		ID: &nestID,
	})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, status.Errorf(codes.NotFound, "nest not found")
	}

	newNestID, err := ExtractNestIDFromName(request.MoveTo)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid target nest name: %v", err)
	}
	newNest, err := s.Store.GetNest(ctx, &store.FindNest{
		ID: &newNestID,
	})
	if err != nil {
		return nil, err
	}
	if newNest == nil {
		return nil, status.Errorf(codes.NotFound, "target nest not found")
	}

	// Only the creator or admin can update the nest.
	if (nest.CreatorID != user.ID || newNest.CreatorID != user.ID) && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get nest memos")
	}
	for _, memo := range memos {
		err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{
			ID:   memo.ID,
			Nest: &newNestID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to move memo")
		}
	}

	if err = s.Store.DeleteNest(ctx, &store.DeleteNest{ID: nestID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete nest")
	}

	return &emptypb.Empty{}, nil
}

func convertNestFromStore(nest *store.Nest) (*v1pb.Nest, error) {
	id := fmt.Sprintf("%s%d", NestNamePrefix, nest.ID)
	nestMessage := &v1pb.Nest{
		Id:         id,
		Name:       nest.Name,
		CreateTime: timestamppb.New(time.Unix(nest.CreatedTs, 0)),
	}

	return nestMessage, nil
}

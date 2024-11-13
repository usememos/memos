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
		UID:       request.Uid,
	}

	nest, err := s.Store.CreateNest(ctx, create)
	if err != nil {
		return nil, err
	}

	nestMessage, err := s.convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}

	return nestMessage, nil
}

func (s *APIV1Service) ListNests(ctx context.Context, request *v1pb.ListNestsRequest) (*v1pb.ListNestsResponse, error) {
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

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	} else {
		limit = int(request.PageSize)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	limitPlusOne := limit + 1
	nestFind.Limit = &limitPlusOne
	nestFind.Offset = &offset

	nests, err := s.Store.ListNests(ctx, nestFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list nests: %v", err)
	}

	nestMessages := []*v1pb.Nest{}
	nextPageToken := ""
	if len(nests) == limitPlusOne {
		nests = nests[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}
	for _, nest := range nests {
		nestMessage, err := s.convertNestFromStore(nest)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert nest")
		}
		nestMessages = append(nestMessages, nestMessage)
	}

	response := &v1pb.ListNestsResponse{
		Nests:         nestMessages,
		NextPageToken: nextPageToken,
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

	id, err := ExtractNestIDFromName(request.Name)
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

	nestMessage, err := s.convertNestFromStore(nest)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert nest")
	}
	return nestMessage, nil
}

//nolint:all
func (s *APIV1Service) GetNestByUid(ctx context.Context, request *v1pb.GetNestByUidRequest) (*v1pb.Nest, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	nest, err := s.Store.GetNest(ctx, &store.FindNest{
		UID:       &request.Uid,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, status.Errorf(codes.NotFound, "nest not found")
	}

	nestMessage, err := s.convertNestFromStore(nest)
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

	id, err := ExtractNestIDFromName(request.Nest.Name)
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

	currentTs := time.Now().Unix()
	update := &store.UpdateNest{
		ID:        id,
		UpdatedTs: &currentTs,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "uid" {
			update.UID = &request.Nest.Uid
			if !util.UIDMatcher.MatchString(*update.UID) {
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
	nestMessage, err := s.convertNestFromStore(nest)
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

	id, err := ExtractNestIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid nest name: %v", err)
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

	if err = s.Store.DeleteNest(ctx, &store.DeleteNest{ID: id}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete nest")
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) convertNestFromStore(nest *store.Nest) (*v1pb.Nest, error) {
	name := fmt.Sprintf("%s%d", NestNamePrefix, nest.ID)
	nestMessage := &v1pb.Nest{
		Name:       name,
		Uid:        nest.UID,
		CreateTime: timestamppb.New(time.Unix(nest.CreatedTs, 0)),
	}

	return nestMessage, nil
}

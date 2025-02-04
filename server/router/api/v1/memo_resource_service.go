package v1

import (
	"context"
	"slices"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) SetMemoResources(ctx context.Context, request *v1pb.SetMemoResourcesRequest) (*emptypb.Empty, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo")
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	// Delete resources that are not in the request.
	for _, resource := range resources {
		found := false
		for _, requestResource := range request.Resources {
			requestResourceUID, err := ExtractResourceUIDFromName(requestResource.Name)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
			}
			if resource.UID == requestResourceUID {
				found = true
				break
			}
		}
		if !found {
			if err = s.Store.DeleteResource(ctx, &store.DeleteResource{
				ID:     int32(resource.ID),
				MemoID: &memo.ID,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to delete resource")
			}
		}
	}

	slices.Reverse(request.Resources)
	// Update resources' memo_id in the request.
	for index, resource := range request.Resources {
		resourceUID, err := ExtractResourceUIDFromName(resource.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
		}
		tempResource, err := s.Store.GetResource(ctx, &store.FindResource{UID: &resourceUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get resource: %v", err)
		}
		updatedTs := time.Now().Unix() + int64(index)
		if err := s.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:        tempResource.ID,
			MemoID:    &memo.ID,
			UpdatedTs: &updatedTs,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
		}
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListMemoResources(ctx context.Context, request *v1pb.ListMemoResourcesRequest) (*v1pb.ListMemoResourcesResponse, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources: %v", err)
	}

	response := &v1pb.ListMemoResourcesResponse{
		Resources: []*v1pb.Resource{},
	}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

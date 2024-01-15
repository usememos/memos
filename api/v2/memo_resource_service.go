package v2

import (
	"context"
	"slices"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) SetMemoResources(ctx context.Context, request *apiv2pb.SetMemoResourcesRequest) (*apiv2pb.SetMemoResourcesResponse, error) {
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	// Delete resources that are not in the request.
	for _, resource := range resources {
		found := false
		for _, requestResource := range request.Resources {
			if resource.ID == int32(requestResource.Id) {
				found = true
				break
			}
		}
		if !found {
			if err = s.Store.DeleteResource(ctx, &store.DeleteResource{
				ID:     int32(resource.ID),
				MemoID: &request.Id,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to delete resource")
			}
		}
	}

	slices.Reverse(request.Resources)
	// Update resources' memo_id in the request.
	for index, resource := range request.Resources {
		updatedTs := time.Now().Unix() + int64(index)
		if _, err := s.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:        resource.Id,
			MemoID:    &request.Id,
			UpdatedTs: &updatedTs,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
		}
	}

	return &apiv2pb.SetMemoResourcesResponse{}, nil
}

func (s *APIV2Service) ListMemoResources(ctx context.Context, request *apiv2pb.ListMemoResourcesRequest) (*apiv2pb.ListMemoResourcesResponse, error) {
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	response := &apiv2pb.ListMemoResourcesResponse{
		Resources: []*apiv2pb.Resource{},
	}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

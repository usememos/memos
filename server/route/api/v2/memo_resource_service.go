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
	memoID, err := ExtractMemoIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &memoID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	// Delete resources that are not in the request.
	for _, resource := range resources {
		found := false
		for _, requestResource := range request.Resources {
			if resource.UID == requestResource.Uid {
				found = true
				break
			}
		}
		if !found {
			if err = s.Store.DeleteResource(ctx, &store.DeleteResource{
				ID:     int32(resource.ID),
				MemoID: &memoID,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to delete resource")
			}
		}
	}

	slices.Reverse(request.Resources)
	// Update resources' memo_id in the request.
	for index, resource := range request.Resources {
		id, err := ExtractResourceIDFromName(resource.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
		}
		updatedTs := time.Now().Unix() + int64(index)
		if _, err := s.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:        id,
			MemoID:    &memoID,
			UpdatedTs: &updatedTs,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
		}
	}

	return &apiv2pb.SetMemoResourcesResponse{}, nil
}

func (s *APIV2Service) ListMemoResources(ctx context.Context, request *apiv2pb.ListMemoResourcesRequest) (*apiv2pb.ListMemoResourcesResponse, error) {
	id, err := ExtractMemoIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &id,
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

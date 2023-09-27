package v2

import (
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

type ResourceService struct {
	apiv2pb.UnimplementedResourceServiceServer

	Store *store.Store
}

// NewResourceService creates a new ResourceService.
func NewResourceService(store *store.Store) *ResourceService {
	return &ResourceService{
		Store: store,
	}
}

func (s *ResourceService) ListResources(ctx context.Context, _ *apiv2pb.ListResourcesRequest) (*apiv2pb.ListResourcesResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources: %v", err)
	}

	response := &apiv2pb.ListResourcesResponse{}
	for _, resource := range resources {
		response.Resources = append(response.Resources, convertResourceFromStore(resource))
	}
	return response, nil
}

func (s *ResourceService) DeleteResource(ctx context.Context, request *apiv2pb.DeleteResourceRequest) (*apiv2pb.DeleteResourceResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID:        &request.Id,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find resource: %v", err)
	}
	if resource == nil {
		return nil, status.Errorf(codes.NotFound, "resource not found")
	}
	if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
		ID: resource.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete resource: %v", err)
	}
	return &apiv2pb.DeleteResourceResponse{}, nil
}

func convertResourceFromStore(resource *store.Resource) *apiv2pb.Resource {
	return &apiv2pb.Resource{
		Id:           resource.ID,
		CreatedTs:    timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:     resource.Filename,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
		MemoId:       resource.MemoID,
	}
}

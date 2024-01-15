package v2

import (
	"context"
	"net/url"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateResource(ctx context.Context, request *apiv2pb.CreateResourceRequest) (*apiv2pb.CreateResourceResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if request.ExternalLink != "" {
		// Only allow those external links scheme with http/https
		linkURL, err := url.Parse(request.ExternalLink)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link: %v", err)
		}
		if linkURL.Scheme != "http" && linkURL.Scheme != "https" {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link scheme: %v", linkURL.Scheme)
		}
	}

	create := &store.Resource{
		CreatorID:    user.ID,
		Filename:     request.Filename,
		ExternalLink: request.ExternalLink,
		Type:         request.Type,
	}
	if request.MemoId != nil {
		create.MemoID = request.MemoId
	}
	resource, err := s.Store.CreateResource(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create resource: %v", err)
	}
	return &apiv2pb.CreateResourceResponse{
		Resource: s.convertResourceFromStore(ctx, resource),
	}, nil
}

func (s *APIV2Service) ListResources(ctx context.Context, _ *apiv2pb.ListResourcesRequest) (*apiv2pb.ListResourcesResponse, error) {
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
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *APIV2Service) UpdateResource(ctx context.Context, request *apiv2pb.UpdateResourceRequest) (*apiv2pb.UpdateResourceResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateResource{
		ID:        request.Resource.Id,
		UpdatedTs: &currentTs,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "filename" {
			update.Filename = &request.Resource.Filename
		} else if field == "memo_id" {
			update.MemoID = request.Resource.MemoId
		}
	}

	resource, err := s.Store.UpdateResource(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
	}
	return &apiv2pb.UpdateResourceResponse{
		Resource: s.convertResourceFromStore(ctx, resource),
	}, nil
}

func (s *APIV2Service) DeleteResource(ctx context.Context, request *apiv2pb.DeleteResourceRequest) (*apiv2pb.DeleteResourceResponse, error) {
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
	// Delete the resource from the database.
	if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
		ID: resource.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete resource: %v", err)
	}
	return &apiv2pb.DeleteResourceResponse{}, nil
}

func (s *APIV2Service) convertResourceFromStore(ctx context.Context, resource *store.Resource) *apiv2pb.Resource {
	var memoID *int32
	if resource.MemoID != nil {
		memo, _ := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: resource.MemoID,
		})
		if memo != nil {
			memoID = &memo.ID
		}
	}

	return &apiv2pb.Resource{
		Id:           resource.ID,
		CreateTime:   timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:     resource.Filename,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
		MemoId:       memoID,
	}
}

package v2

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/common/log"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

const (
	// thumbnailImagePath is the directory to store image thumbnails.
	thumbnailImagePath = ".thumbnail_cache"
)

type ResourceService struct {
	apiv2pb.UnimplementedResourceServiceServer

	Profile *profile.Profile
	Store   *store.Store
}

// NewResourceService creates a new ResourceService.
func NewResourceService(profile *profile.Profile, store *store.Store) *ResourceService {
	return &ResourceService{
		Profile: profile,
		Store:   store,
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
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *ResourceService) UpdateResource(ctx context.Context, request *apiv2pb.UpdateResourceRequest) (*apiv2pb.UpdateResourceResponse, error) {
	currentTs := time.Now().Unix()
	update := &store.UpdateResource{
		ID:        request.Id,
		UpdatedTs: &currentTs,
	}
	for _, field := range request.UpdateMask {
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
	// Delete the local file synchronously if it exists.
	if resource.InternalPath != "" {
		if err := os.Remove(resource.InternalPath); err != nil {
			log.Warn(fmt.Sprintf("failed to delete local file with path %s", resource.InternalPath), zap.Error(err))
		}
	}
	// Delete the local thumbnail synchronously if it exists.
	thumbnailPath := filepath.Join(s.Profile.Data, thumbnailImagePath, fmt.Sprintf("%d%s", resource.ID, filepath.Ext(resource.Filename)))
	if err := os.Remove(thumbnailPath); err != nil {
		log.Warn(fmt.Sprintf("failed to delete local thumbnail with path %s", thumbnailPath), zap.Error(err))
	}
	// Delete the resource from the database.
	if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
		ID: resource.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete resource: %v", err)
	}
	return &apiv2pb.DeleteResourceResponse{}, nil
}

func (s *ResourceService) convertResourceFromStore(ctx context.Context, resource *store.Resource) *apiv2pb.Resource {
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
		CreatedTs:    timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:     resource.Filename,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
		MemoId:       memoID,
	}
}

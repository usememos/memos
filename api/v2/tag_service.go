package v2

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) UpsertTag(ctx context.Context, request *apiv2pb.UpsertTagRequest) (*apiv2pb.UpsertTagResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}

	tag, err := s.Store.UpsertTag(ctx, &store.Tag{
		Name:      request.Name,
		CreatorID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert tag: %v", err)
	}

	return &apiv2pb.UpsertTagResponse{
		Tag: convertTagFromStore(tag),
	}, nil
}

func (s *APIV2Service) ListTags(ctx context.Context, request *apiv2pb.ListTagsRequest) (*apiv2pb.ListTagsResponse, error) {
	tags, err := s.Store.ListTags(ctx, &store.FindTag{
		CreatorID: request.CreatorId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list tags: %v", err)
	}

	response := &apiv2pb.ListTagsResponse{}
	for _, tag := range tags {
		response.Tags = append(response.Tags, convertTagFromStore(tag))
	}
	return response, nil
}

func (s *APIV2Service) DeleteTag(ctx context.Context, request *apiv2pb.DeleteTagRequest) (*apiv2pb.DeleteTagResponse, error) {
	err := s.Store.DeleteTag(ctx, &store.DeleteTag{
		Name:      request.Tag.Name,
		CreatorID: request.Tag.CreatorId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete tag: %v", err)
	}

	return &apiv2pb.DeleteTagResponse{}, nil
}

func convertTagFromStore(tag *store.Tag) *apiv2pb.Tag {
	return &apiv2pb.Tag{
		Name:      tag.Name,
		CreatorId: int32(tag.CreatorID),
	}
}

package v2

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

type TagService struct {
	apiv2pb.UnimplementedTagServiceServer

	Store *store.Store
}

// NewTagService creates a new TagService.
func NewTagService(store *store.Store) *TagService {
	return &TagService{
		Store: store,
	}
}

func (s *TagService) ListTags(ctx context.Context, request *apiv2pb.ListTagsRequest) (*apiv2pb.ListTagsResponse, error) {
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

func convertTagFromStore(tag *store.Tag) *apiv2pb.Tag {
	return &apiv2pb.Tag{
		Name:      tag.Name,
		CreatorId: int32(tag.CreatorID),
	}
}

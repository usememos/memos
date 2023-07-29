package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

type TagService struct {
	apiv2pb.UnimplementedTagServiceServer
}

// NewTagService creates a new TagService.
func NewTagService() *TagService {
	return &TagService{}
}

func (s *TagService) ListTags(ctx context.Context, request *apiv2pb.ListTagsRequest) (*apiv2pb.ListTagsResponse, error) {
	// TODO: implement.
	return &apiv2pb.ListTagsResponse{
		Tags: []*apiv2pb.Tag{},
	}, nil
}

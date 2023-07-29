package v2

import (
	"context"

	"github.com/usememos/memos/proto/gen/apiv2"
)

type TagService struct {
	apiv2.UnimplementedTagServiceServer
}

// NewTagService creates a new TagService.
func NewTagService() *TagService {
	return &TagService{}
}

func (s *TagService) ListTags(ctx context.Context, request *apiv2.ListTagsRequest) (*apiv2.ListTagsResponse, error) {
	// TODO: implement.
	return &apiv2.ListTagsResponse{
		Tags: []*apiv2.Tag{},
	}, nil
}

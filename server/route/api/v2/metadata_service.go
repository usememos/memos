package v2

import (
	"context"

	getter "github.com/usememos/memos/plugin/http-getter"
	api "github.com/usememos/memos/proto/gen/api/v2"
)

func (s *APIV2Service) GetMetadata(ctx context.Context, request *api.GetMetadataRequest) (*api.GetMetadataResponse, error) {
	urlStr := request.Url

	htmlMeta, err := getter.GetHTMLMeta(urlStr)
	if err != nil {
		return nil, err
	}

	return &api.GetMetadataResponse{
		Metadata: &api.Metadata{
			Title:       htmlMeta.Title,
			Description: htmlMeta.Description,
			Image:       htmlMeta.Image,
		},
	}, nil
}

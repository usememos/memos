package v2

import (
	"context"

	getter "github.com/usememos/memos/plugin/http-getter"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (_ *APIV2Service) GetMetadata(ctx context.Context, request *apiv2pb.GetMetadataRequest) (*apiv2pb.GetMetadataResponse, error) {
	urlStr := request.Url

	htmlMeta, err := getter.GetHTMLMeta(urlStr)
	if err != nil {
		return nil, err
	}

	return &apiv2pb.GetMetadataResponse{
		Metadata: &apiv2pb.Metadata{
			Title:       htmlMeta.Title,
			Description: htmlMeta.Description,
			Image:       htmlMeta.Image,
		},
	}, nil
}

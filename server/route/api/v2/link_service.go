package v2

import (
	"context"

	getter "github.com/usememos/memos/plugin/http-getter"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
)

func (*APIV2Service) GetLinkMetadata(_ context.Context, request *apiv2pb.GetLinkMetadataRequest) (*apiv2pb.GetLinkMetadataResponse, error) {
	htmlMeta, err := getter.GetHTMLMeta(request.Link)
	if err != nil {
		return nil, err
	}

	return &apiv2pb.GetLinkMetadataResponse{
		LinkMetadata: &apiv2pb.LinkMetadata{
			Title:       htmlMeta.Title,
			Description: htmlMeta.Description,
			Image:       htmlMeta.Image,
		},
	}, nil
}

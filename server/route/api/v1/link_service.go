package v1

import (
	"context"

	getter "github.com/usememos/memos/plugin/http-getter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func (*APIV1Service) GetLinkMetadata(_ context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.GetLinkMetadataResponse, error) {
	htmlMeta, err := getter.GetHTMLMeta(request.Link)
	if err != nil {
		return nil, err
	}

	return &v1pb.GetLinkMetadataResponse{
		LinkMetadata: &v1pb.LinkMetadata{
			Title:       htmlMeta.Title,
			Description: htmlMeta.Description,
			Image:       htmlMeta.Image,
		},
	}, nil
}

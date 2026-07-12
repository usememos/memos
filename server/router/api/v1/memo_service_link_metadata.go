package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// GetLinkMetadata gets metadata for a link.
func (*APIV1Service) GetLinkMetadata(_ context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	return getLinkMetadata(request.GetUrl())
}

// BatchGetLinkMetadata gets metadata for links.
func (*APIV1Service) BatchGetLinkMetadata(_ context.Context, request *v1pb.BatchGetLinkMetadataRequest) (*v1pb.BatchGetLinkMetadataResponse, error) {
	if len(request.Urls) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "urls are required")
	}
	if len(request.Urls) > maxBatchGetLinkMetadata {
		return nil, status.Errorf(codes.InvalidArgument, "too many urls (max %d)", maxBatchGetLinkMetadata)
	}

	linkMetadata := make([]*v1pb.LinkMetadata, 0, len(request.Urls))
	for _, url := range request.Urls {
		metadata, err := getLinkMetadata(url)
		if err != nil {
			return nil, err
		}
		linkMetadata = append(linkMetadata, metadata)
	}

	return &v1pb.BatchGetLinkMetadataResponse{
		LinkMetadata: linkMetadata,
	}, nil
}

func getLinkMetadata(inputURL string) (*v1pb.LinkMetadata, error) {
	url := strings.TrimSpace(inputURL)
	if url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}
	htmlMeta, err := fetchHTMLMeta(url)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to fetch link metadata: %v", err)
	}

	return &v1pb.LinkMetadata{
		Url:         inputURL,
		Title:       htmlMeta.Title,
		Description: htmlMeta.Description,
		Image:       htmlMeta.Image,
	}, nil
}

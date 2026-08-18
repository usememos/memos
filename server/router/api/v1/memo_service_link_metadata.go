package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

type linkMetadataFetcher interface {
	Get(context.Context, string) (*httpgetter.HTMLMeta, error)
}

// GetLinkMetadata gets metadata for a link.
func (s *APIV1Service) GetLinkMetadata(ctx context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	return s.buildLinkMetadata(ctx, request.GetUrl())
}

// BatchGetLinkMetadata gets metadata for links.
func (s *APIV1Service) BatchGetLinkMetadata(ctx context.Context, request *v1pb.BatchGetLinkMetadataRequest) (*v1pb.BatchGetLinkMetadataResponse, error) {
	if len(request.Urls) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "urls are required")
	}
	if len(request.Urls) > maxBatchGetLinkMetadata {
		return nil, status.Errorf(codes.InvalidArgument, "too many urls (max %d)", maxBatchGetLinkMetadata)
	}

	linkMetadata := make([]*v1pb.LinkMetadata, 0, len(request.Urls))
	for _, url := range request.Urls {
		metadata, err := s.buildLinkMetadata(ctx, url)
		if err != nil {
			return nil, err
		}
		linkMetadata = append(linkMetadata, metadata)
	}

	return &v1pb.BatchGetLinkMetadataResponse{
		LinkMetadata: linkMetadata,
	}, nil
}

func (s *APIV1Service) buildLinkMetadata(ctx context.Context, inputURL string) (*v1pb.LinkMetadata, error) {
	url := strings.TrimSpace(inputURL)
	if url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}
	htmlMeta, err := s.linkMetadataFetcher.Get(ctx, url)
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

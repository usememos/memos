package v1

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/linkmeta"
	"github.com/usememos/memos/internal/ratelimit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

type linkMetadataFetcher interface {
	Get(context.Context, string) (*linkmeta.HTMLMeta, error)
}

// GetLinkMetadata gets metadata for a link.
func (s *APIV1Service) GetLinkMetadata(ctx context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	if err := s.throttleLinkMetadata(ctx, 1); err != nil {
		return nil, err
	}
	return s.buildLinkMetadata(ctx, request.GetUrl())
}

// throttleLinkMetadata bounds outbound fetches per caller. Cached results
// still cost, since the point is to bound how often a caller can ask.
func (s *APIV1Service) throttleLinkMetadata(ctx context.Context, urls int) error {
	_, key := callerBudget(ctx)
	return s.throttleAndCharge(ratelimit.ScopeLinkMetadata, key, urls)
}

// BatchGetLinkMetadata gets metadata for links.
func (s *APIV1Service) BatchGetLinkMetadata(ctx context.Context, request *v1pb.BatchGetLinkMetadataRequest) (*v1pb.BatchGetLinkMetadataResponse, error) {
	if len(request.Urls) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "urls are required")
	}
	if len(request.Urls) > maxBatchGetLinkMetadata {
		return nil, status.Errorf(codes.InvalidArgument, "too many urls (max %d)", maxBatchGetLinkMetadata)
	}
	if err := s.throttleLinkMetadata(ctx, len(request.Urls)); err != nil {
		return nil, err
	}
	s.chargeBatch(ctx, len(request.Urls))

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

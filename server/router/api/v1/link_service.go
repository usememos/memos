package v1

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/plugin/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// GetLinkMetadata fetches OpenGraph metadata for a given URL.
func (s *APIV1Service) GetLinkMetadata(ctx context.Context, request *v1pb.GetLinkMetadataRequest) (*v1pb.LinkMetadata, error) {
	// Check if link previews are enabled
	memoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance memo related setting: %v", err)
	}
	if !memoRelatedSetting.EnableOpengraphLinkPreviews {
		return nil, status.Errorf(codes.PermissionDenied, "opengraph link previews are disabled")
	}

	// Validate URL
	if request.Url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "url is required")
	}

	// Fetch metadata using httpgetter
	htmlMeta, err := httpgetter.GetHTMLMeta(request.Url)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to fetch link metadata: %v", err)
	}

	return &v1pb.LinkMetadata{
		Title:       htmlMeta.Title,
		Description: htmlMeta.Description,
		Image:       htmlMeta.Image,
	}, nil
}


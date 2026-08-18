package v1

import (
	"context"
	"fmt"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/internal/httpgetter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

type fakeLinkMetadataFetcher func(context.Context, string) (*httpgetter.HTMLMeta, error)

type linkMetadataContextKey struct{}

func (fetch fakeLinkMetadataFetcher) Get(ctx context.Context, url string) (*httpgetter.HTMLMeta, error) {
	return fetch(ctx, url)
}

func TestGetLinkMetadata(t *testing.T) {
	requestContext := context.WithValue(context.Background(), linkMetadataContextKey{}, "context value")
	service := &APIV1Service{
		linkMetadataFetcher: fakeLinkMetadataFetcher(func(ctx context.Context, url string) (*httpgetter.HTMLMeta, error) {
			require.Same(t, requestContext, ctx)
			require.Equal(t, "https://example.com/article", url)
			return &httpgetter.HTMLMeta{
				Title:       "Example title",
				Description: "Example description",
				Image:       "https://example.com/cover.png",
			}, nil
		}),
	}

	metadata, err := service.GetLinkMetadata(requestContext, &v1pb.GetLinkMetadataRequest{
		Url: "https://example.com/article",
	})
	require.NoError(t, err)
	require.Equal(t, "https://example.com/article", metadata.Url)
	require.Equal(t, "Example title", metadata.Title)
	require.Equal(t, "Example description", metadata.Description)
	require.Equal(t, "https://example.com/cover.png", metadata.Image)
}

func TestGetLinkMetadataEmptyURL(t *testing.T) {
	_, err := (&APIV1Service{}).GetLinkMetadata(context.Background(), &v1pb.GetLinkMetadataRequest{})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestGetLinkMetadataFetchError(t *testing.T) {
	service := &APIV1Service{
		linkMetadataFetcher: fakeLinkMetadataFetcher(func(context.Context, string) (*httpgetter.HTMLMeta, error) {
			return nil, errors.New("fetch failed")
		}),
	}
	_, err := service.GetLinkMetadata(context.Background(), &v1pb.GetLinkMetadataRequest{Url: "https://example.com"})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Contains(t, err.Error(), "failed to fetch link metadata")
}

func TestGetLinkMetadataInternalURL(t *testing.T) {
	service := &APIV1Service{linkMetadataFetcher: httpgetter.NewHTMLMetaFetcher()}
	_, err := service.GetLinkMetadata(context.Background(), &v1pb.GetLinkMetadataRequest{
		Url: "http://192.168.0.1",
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestBatchGetLinkMetadataPreservesOrder(t *testing.T) {
	var fetchedURLs []string
	service := &APIV1Service{
		linkMetadataFetcher: fakeLinkMetadataFetcher(func(_ context.Context, url string) (*httpgetter.HTMLMeta, error) {
			fetchedURLs = append(fetchedURLs, url)
			return &httpgetter.HTMLMeta{
				Title:       fmt.Sprintf("Title for %s", url),
				Description: fmt.Sprintf("Description for %s", url),
				Image:       fmt.Sprintf("%s/cover.png", url),
			}, nil
		}),
	}

	response, err := service.BatchGetLinkMetadata(context.Background(), &v1pb.BatchGetLinkMetadataRequest{
		Urls: []string{
			"https://example.com/one",
			"https://example.com/two",
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"https://example.com/one", "https://example.com/two"}, fetchedURLs)
	require.Len(t, response.LinkMetadata, 2)
	require.Equal(t, "https://example.com/one", response.LinkMetadata[0].Url)
	require.Equal(t, "Title for https://example.com/one", response.LinkMetadata[0].Title)
	require.Equal(t, "https://example.com/two", response.LinkMetadata[1].Url)
	require.Equal(t, "Title for https://example.com/two", response.LinkMetadata[1].Title)
}

func TestBatchGetLinkMetadataStopsOnError(t *testing.T) {
	var fetchedURLs []string
	service := &APIV1Service{
		linkMetadataFetcher: fakeLinkMetadataFetcher(func(_ context.Context, url string) (*httpgetter.HTMLMeta, error) {
			fetchedURLs = append(fetchedURLs, url)
			if url == "https://example.com/two" {
				return nil, errors.New("fetch failed")
			}
			return &httpgetter.HTMLMeta{Title: url}, nil
		}),
	}

	_, err := service.BatchGetLinkMetadata(context.Background(), &v1pb.BatchGetLinkMetadataRequest{
		Urls: []string{"https://example.com/one", "https://example.com/two", "https://example.com/three"},
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.Equal(t, []string{"https://example.com/one", "https://example.com/two"}, fetchedURLs)
}

func TestBatchGetLinkMetadataEmptyURLs(t *testing.T) {
	_, err := (&APIV1Service{}).BatchGetLinkMetadata(context.Background(), &v1pb.BatchGetLinkMetadataRequest{})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestBatchGetLinkMetadataTooManyURLs(t *testing.T) {
	urls := make([]string, maxBatchGetLinkMetadata+1)
	for i := range urls {
		urls[i] = fmt.Sprintf("https://example.com/%d", i)
	}

	_, err := (&APIV1Service{}).BatchGetLinkMetadata(context.Background(), &v1pb.BatchGetLinkMetadataRequest{
		Urls: urls,
	})
	require.Error(t, err)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}

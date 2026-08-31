package v1

import (
	"context"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/httpgetter"
	"github.com/usememos/memos/internal/markdown"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
	storetest "github.com/usememos/memos/store/test"
)

func newLinkEnrichmentTestService(t *testing.T, fetch linkMetadataFetcher) *APIV1Service {
	t.Helper()
	ctx := context.Background()
	stores := storetest.NewTestingStore(ctx, t)
	return &APIV1Service{
		Profile:             &profile.Profile{Data: t.TempDir()},
		Store:               stores,
		MarkdownService:     markdown.NewService(markdown.WithTagExtension(), markdown.WithMentionExtension()),
		linkMetadataFetcher: fetch,
	}
}

type stubFetchResults struct {
	metas  map[string]*httpgetter.HTMLMeta
	images map[string]*httpgetter.Image
}

func (s stubFetchResults) Get(_ context.Context, url string) (*httpgetter.HTMLMeta, error) {
	if meta, ok := s.metas[url]; ok {
		return meta, nil
	}
	return nil, errors.New("no metadata")
}

func (s stubFetchResults) GetImage(_ context.Context, url string) (*httpgetter.Image, error) {
	if image, ok := s.images[url]; ok {
		return image, nil
	}
	return nil, errors.New("no image")
}

func TestEnrichMemoLinksPersistsMetadata(t *testing.T) {
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			"https://example.com/a": {Title: "Example A", Description: "Desc A", Image: "https://example.com/a.png"},
		},
		images: map[string]*httpgetter.Image{
			"https://example.com/a.png": {Blob: []byte("fakepng"), Mediatype: "image/png"},
		},
	})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memo)

	require.Len(t, memo.Payload.Links, 1)
	entry := memo.Payload.Links[0]
	require.Equal(t, "https://example.com/a", entry.Url)
	require.Equal(t, "Example A", entry.Title)
	require.Equal(t, "Desc A", entry.Description)
	require.NotEmpty(t, entry.CoverAttachmentUid, "cover attachment should be cached")

	// The cached cover must be a standalone attachment of the memo creator.
	cover, err := service.Store.GetAttachment(context.Background(), &store.FindAttachment{UID: &entry.CoverAttachmentUid})
	require.NoError(t, err)
	require.NotNil(t, cover)
	require.Equal(t, int32(1), cover.CreatorID)
	require.Equal(t, "image/png", cover.Type)
	require.Contains(t, cover.Filename, coverFilenamePrefix)
}

func TestEnrichMemoLinksReusesExistingEntries(t *testing.T) {
	fetchCount := 0
	service := newLinkEnrichmentTestService(t, stubCountingFetcher{inner: stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			"https://example.com/a": {Title: "Example A"},
		},
	}, count: &fetchCount})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memo)
	require.Equal(t, 1, fetchCount)

	// Simulate an edit that keeps the link: no refetch, entry preserved.
	service.EnrichMemoLinks(context.Background(), memo)
	require.Equal(t, 1, fetchCount)
	require.Len(t, memo.Payload.Links, 1)
	require.Equal(t, "Example A", memo.Payload.Links[0].Title)
}

func TestEnrichMemoLinksToleratesFailures(t *testing.T) {
	service := newLinkEnrichmentTestService(t, stubFetchResults{})

	memo := &store.Memo{CreatorID: 1, Content: "Read https://example.com/dead now"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memo)
	require.Empty(t, memo.Payload.Links, "failed fetch must not block or add entries")

	memoWithNoLinks := &store.Memo{CreatorID: 1, Content: "just text"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memoWithNoLinks, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memoWithNoLinks)
	require.Empty(t, memoWithNoLinks.Payload.Links)
}

func TestCoverFilenameIsDeterministic(t *testing.T) {
	first := coverFilename("https://a.com/page", "https://img.a.com/pic.jpg?v=2")
	second := coverFilename("https://a.com/page", "https://img.a.com/pic.jpg?v=2")
	require.Equal(t, first, second)
	require.Contains(t, first, ".jpg")
	require.NotEqual(t, first, coverFilename("https://a.com/other", "https://img.a.com/pic.jpg?v=2"))
}

type stubCountingFetcher struct {
	inner linkMetadataFetcher
	count *int
}

func (s stubCountingFetcher) Get(ctx context.Context, url string) (*httpgetter.HTMLMeta, error) {
	*s.count++
	return s.inner.Get(ctx, url)
}

func (s stubCountingFetcher) GetImage(ctx context.Context, url string) (*httpgetter.Image, error) {
	return s.inner.GetImage(ctx, url)
}

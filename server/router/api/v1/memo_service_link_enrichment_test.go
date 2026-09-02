package v1

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/httpgetter"
	"github.com/usememos/memos/internal/markdown"
	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/server/runner/memopayload"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
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
	require.Len(t, memo.Payload.Links, 1, "failed fetch must persist a placeholder entry carrying retry state")
	placeholder := memo.Payload.Links[0]
	require.Empty(t, placeholder.Title)
	require.Equal(t, int32(1), placeholder.FetchAttempts)
	require.Positive(t, placeholder.FirstAttemptAt)
	require.Equal(t, placeholder.FirstAttemptAt, placeholder.LastAttemptAt)

	memoWithNoLinks := &store.Memo{CreatorID: 1, Content: "just text"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memoWithNoLinks, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memoWithNoLinks)
	require.Empty(t, memoWithNoLinks.Payload.Links)
}

func TestBackoffDelaySchedule(t *testing.T) {
	require.Equal(t, 5*time.Minute, backoffDelay(1))
	require.Equal(t, 15*time.Minute, backoffDelay(2))
	require.Equal(t, 30*time.Minute, backoffDelay(3))
	require.Equal(t, time.Hour, backoffDelay(4))
	require.Equal(t, 2*time.Hour, backoffDelay(5))
	require.Equal(t, 4*time.Hour, backoffDelay(6))
	require.Equal(t, 8*time.Hour, backoffDelay(7))
	require.Equal(t, 8*time.Hour, backoffDelay(20))
}

func TestPrepareRetry(t *testing.T) {
	now := time.Now()

	// Legacy entry persisted before retry bookkeeping: fresh window, due now.
	legacy := &storepb.MemoPayload_LinkMetadata{Url: "https://example.com/a"}
	require.True(t, prepareRetry(legacy, now))
	require.Equal(t, int32(1), legacy.FetchAttempts)
	require.Equal(t, now.Unix(), legacy.FirstAttemptAt)
	require.Zero(t, legacy.LastAttemptAt)

	// Gated: last failure 2m ago, backoff for attempt 1 is 5m.
	gated := &storepb.MemoPayload_LinkMetadata{Url: "https://example.com/a", FetchAttempts: 1, FirstAttemptAt: now.Add(-10 * time.Minute).Unix(), LastAttemptAt: now.Add(-2 * time.Minute).Unix()}
	require.False(t, prepareRetry(gated, now))

	// Due: last failure 6m ago.
	due := &storepb.MemoPayload_LinkMetadata{Url: "https://example.com/a", FetchAttempts: 1, FirstAttemptAt: now.Add(-10 * time.Minute).Unix(), LastAttemptAt: now.Add(-6 * time.Minute).Unix()}
	require.True(t, prepareRetry(due, now))

	// Exhausted: first failure more than 24h ago.
	exhausted := &storepb.MemoPayload_LinkMetadata{Url: "https://example.com/a", FetchAttempts: 8, FirstAttemptAt: now.Add(-25 * time.Hour).Unix(), LastAttemptAt: now.Add(-9 * time.Hour).Unix()}
	require.False(t, prepareRetry(exhausted, now))
}

func TestEnrichMemoLinksRetriesMissingCover(t *testing.T) {
	metaCount, imageCount := 0, 0
	service := newLinkEnrichmentTestService(t, stubCountingFetcher{
		inner: stubFetchResults{images: map[string]*httpgetter.Image{
			"https://example.com/a.png": {Blob: []byte("fakepng"), Mediatype: "image/png"},
		}},
		count: &metaCount, imageCount: &imageCount,
	})

	old := time.Now().Add(-10 * time.Minute).Unix()
	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{
		Url: "https://example.com/a", Title: "Example A", Image: "https://example.com/a.png",
		FetchAttempts: 1, FirstAttemptAt: old, LastAttemptAt: old,
	}}

	service.EnrichMemoLinks(context.Background(), memo)

	require.Equal(t, 0, metaCount, "metadata present: no metadata refetch")
	require.Equal(t, 1, imageCount, "cover retry must fetch the image")
	entry := memo.Payload.Links[0]
	require.NotEmpty(t, entry.CoverAttachmentUid)
	require.Zero(t, entry.FetchAttempts)
	require.Zero(t, entry.FirstAttemptAt)
	require.Zero(t, entry.LastAttemptAt)
	require.Equal(t, "Example A", entry.Title)
}

func TestEnrichMemoLinksCoverRetryFailureKeepsMetadata(t *testing.T) {
	imageCount := 0
	service := newLinkEnrichmentTestService(t, stubCountingFetcher{
		inner:      stubFetchResults{},
		imageCount: &imageCount,
	})

	old := time.Now().Add(-10 * time.Minute).Unix()
	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{
		Url: "https://example.com/a", Title: "Example A", Image: "https://example.com/a.png",
		FetchAttempts: 1, FirstAttemptAt: old, LastAttemptAt: old,
	}}

	service.EnrichMemoLinks(context.Background(), memo)

	require.Equal(t, 1, imageCount)
	entry := memo.Payload.Links[0]
	require.Empty(t, entry.CoverAttachmentUid)
	require.Equal(t, int32(2), entry.FetchAttempts)
	require.Equal(t, old, entry.FirstAttemptAt)
	require.Equal(t, "Example A", entry.Title)
}

func TestEnrichMemoLinksLegacyEntryRetriesImmediately(t *testing.T) {
	imageCount := 0
	service := newLinkEnrichmentTestService(t, stubCountingFetcher{
		inner: stubFetchResults{images: map[string]*httpgetter.Image{
			"https://example.com/a.png": {Blob: []byte("fakepng"), Mediatype: "image/png"},
		}},
		imageCount: &imageCount,
	})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	// Legacy pre-bookkeeping failure: all retry fields zero.
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{
		Url: "https://example.com/a", Title: "Example A", Image: "https://example.com/a.png",
	}}

	service.EnrichMemoLinks(context.Background(), memo)

	require.Equal(t, 1, imageCount, "legacy entries get a fresh window and retry at once")
	require.NotEmpty(t, memo.Payload.Links[0].CoverAttachmentUid)
}

func TestEnrichMemoLinksExhaustedEntryNeverRetries(t *testing.T) {
	metaCount, imageCount := 0, 0
	service := newLinkEnrichmentTestService(t, stubCountingFetcher{
		inner:      stubFetchResults{},
		count:      &metaCount,
		imageCount: &imageCount,
	})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{
		Url: "https://example.com/a", Title: "Example A", Image: "https://example.com/a.png",
		FetchAttempts: 8, FirstAttemptAt: time.Now().Add(-25 * time.Hour).Unix(), LastAttemptAt: time.Now().Add(-9 * time.Hour).Unix(),
	}}

	service.EnrichMemoLinks(context.Background(), memo)

	require.Equal(t, 0, metaCount+imageCount, "exhausted entries stop fetching after 24h")
}

func TestEnrichMemoLinksRecordsCoverDimensions(t *testing.T) {
	// 1x1 transparent PNG.
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			"https://example.com/a": {Title: "Example A", Image: "https://example.com/a.png"},
		},
		images: map[string]*httpgetter.Image{
			"https://example.com/a.png": {Blob: pngBytes, Mediatype: "image/png"},
		},
	})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	service.EnrichMemoLinks(context.Background(), memo)

	entry := memo.Payload.Links[0]
	require.Equal(t, int32(1), entry.CoverWidth)
	require.Equal(t, int32(1), entry.CoverHeight)
}

func TestEnrichMemoLinksBackfillsLegacyCoverDimensions(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{})

	memo := &store.Memo{CreatorID: 1, Content: "[A](https://example.com/a)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{
		Url: "https://example.com/a", Title: "Example A", Image: "https://example.com/a.png", CoverAttachmentUid: seededCoverUID(t, service, pngBytes),
	}}

	service.EnrichMemoLinks(context.Background(), memo)

	entry := memo.Payload.Links[0]
	require.Equal(t, int32(1), entry.CoverWidth)
	require.Equal(t, int32(1), entry.CoverHeight)
}

// seededCoverUID stores a real PNG cover attachment directly and returns its UID.
func seededCoverUID(t *testing.T, service *APIV1Service, blob []byte) string {
	t.Helper()
	created, err := service.Store.CreateAttachment(context.Background(), &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: 1,
		Filename:  "link-cover-seed.png",
		Blob:      blob,
		Type:      "image/png",
		Size:      int64(len(blob)),
	})
	require.NoError(t, err)
	return created.UID
}

func TestRefreshMemoLinkCovers(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			"https://example.com/dead": {Title: "Dead", Image: "https://example.com/dead.png"},
		},
		images: map[string]*httpgetter.Image{
			"https://example.com/a.png": {Blob: pngBytes, Mediatype: "image/png"},
		},
	})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "cover-refresher", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	memo := &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Public, Content: "[A](https://example.com/a) [Dead](https://example.com/dead)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	// Two links pending covers: one will succeed, one will fail again.
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{
		{Url: "https://example.com/a", Title: "A", Image: "https://example.com/a.png", FetchAttempts: 8, FirstAttemptAt: time.Now().Add(-30 * time.Hour).Unix(), LastAttemptAt: time.Now().Add(-20 * time.Hour).Unix()},
		{Url: "https://example.com/dead", Title: "Dead", Image: "https://example.com/dead.png"},
	}
	created, err := service.Store.CreateMemo(context.Background(), memo)
	require.NoError(t, err)
	require.NotNil(t, created)

	// fetchCurrentUser needs a real user in the store with the auth context ID.
	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)
	// Backoff would normally block the exhausted link; refresh ignores it.
	resp, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedLinks)
	require.Equal(t, int32(1), resp.FailedLinks)
	require.Equal(t, int32(1), resp.MemosExamined)

	stored, err := service.Store.GetMemo(ctx, &store.FindMemo{UID: &created.UID})
	require.NoError(t, err)
	aLink := stored.Payload.Links[0]
	require.NotEmpty(t, aLink.CoverAttachmentUid)
	require.Zero(t, aLink.FetchAttempts, "success clears retry bookkeeping")
	deadLink := stored.Payload.Links[1]
	require.Equal(t, int32(1), deadLink.FetchAttempts, "failure restarts the backoff window")
	require.Positive(t, deadLink.LastAttemptAt)
}

func TestRefreshMemoLinkCoversDiscoversNewImage(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			// Page previously had no og:image; now it does.
			"https://example.com/late": {Title: "Late", Description: "Updated", Image: "https://example.com/late.png"},
		},
		images: map[string]*httpgetter.Image{
			"https://example.com/late.png": {Blob: pngBytes, Mediatype: "image/png"},
		},
	})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "late-cover", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	memo := &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Public, Content: "[Late](https://example.com/late)"}
	require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
	// Entry has title/description but no image — the old refresh path skipped these.
	memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{
		{Url: "https://example.com/late", Title: "Late", Description: "Old desc"},
	}
	created, err := service.Store.CreateMemo(context.Background(), memo)
	require.NoError(t, err)

	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)
	resp, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp.UpdatedLinks, "refresh should re-fetch metadata and discover the new image")
	require.Equal(t, int32(0), resp.FailedLinks)
	require.Equal(t, int32(0), resp.SkippedLinks)

	stored, err := service.Store.GetMemo(ctx, &store.FindMemo{UID: &created.UID})
	require.NoError(t, err)
	entry := stored.Payload.Links[0]
	require.NotEmpty(t, entry.CoverAttachmentUid)
	require.Equal(t, "Late", entry.Title)
	require.Equal(t, "Updated", entry.Description)
	require.Zero(t, entry.FetchAttempts)
}

func TestCoverFilenameIsDeterministic(t *testing.T) {
	first := coverFilename("https://a.com/page", "https://img.a.com/pic.jpg?v=2")
	second := coverFilename("https://a.com/page", "https://img.a.com/pic.jpg?v=2")
	require.Equal(t, first, second)
	require.Contains(t, first, ".jpg")
	require.NotEqual(t, first, coverFilename("https://a.com/other", "https://img.a.com/pic.jpg?v=2"))
}

type stubCountingFetcher struct {
	inner      linkMetadataFetcher
	count      *int
	imageCount *int
}

func (s stubCountingFetcher) Get(ctx context.Context, url string) (*httpgetter.HTMLMeta, error) {
	if s.count != nil {
		*s.count++
	}
	return s.inner.Get(ctx, url)
}

func (s stubCountingFetcher) GetImage(ctx context.Context, url string) (*httpgetter.Image, error) {
	if s.imageCount != nil {
		*s.imageCount++
	}
	return s.inner.GetImage(ctx, url)
}

func TestRefreshMemoLinkCoversPagination(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{
		metas: map[string]*httpgetter.HTMLMeta{
			"https://example.com/1": {Title: "1", Image: "https://example.com/1.png"},
			"https://example.com/2": {Title: "2", Image: "https://example.com/2.png"},
			"https://example.com/3": {Title: "3", Image: "https://example.com/3.png"},
		},
		images: map[string]*httpgetter.Image{
			"https://example.com/1.png": {Blob: pngBytes, Mediatype: "image/png"},
			"https://example.com/2.png": {Blob: pngBytes, Mediatype: "image/png"},
			"https://example.com/3.png": {Blob: pngBytes, Mediatype: "image/png"},
		},
	})
	user, err := service.Store.CreateUser(context.Background(), &store.User{Username: "pager", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	for i := 1; i <= 3; i++ {
		url := fmt.Sprintf("https://example.com/%d", i)
		memo := &store.Memo{UID: shortuuid.New(), CreatorID: user.ID, Visibility: store.Public, Content: fmt.Sprintf("[%d](%s)", i, url)}
		require.NoError(t, memopayload.RebuildMemoPayload(context.Background(), memo, service.MarkdownService))
		memo.Payload.Links = []*storepb.MemoPayload_LinkMetadata{{Url: url, Title: fmt.Sprintf("%d", i), Image: url + ".png"}}
		_, err := service.Store.CreateMemo(context.Background(), memo)
		require.NoError(t, err)
	}

	ctx := context.WithValue(context.Background(), auth.UserIDContextKey, user.ID)
	// Page 1 with pageSize 2
	resp1, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{PageSize: 2})
	require.NoError(t, err)
	require.Equal(t, int32(2), resp1.MemosExamined)
	require.Equal(t, "2", resp1.NextPageToken)

	// Page 2 with pageToken "2"
	resp2, err := service.RefreshMemoLinkCovers(ctx, &v1pb.RefreshMemoLinkCoversRequest{PageSize: 2, PageToken: resp1.NextPageToken})
	require.NoError(t, err)
	require.Equal(t, int32(1), resp2.MemosExamined)
	require.Empty(t, resp2.NextPageToken, "last page must have empty NextPageToken")
}

func TestBackfillCoverDimensionsWithLocalStorage(t *testing.T) {
	pngBytes := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82}
	service := newLinkEnrichmentTestService(t, stubFetchResults{})

	// Write file directly to local disk
	localFile := filepath.Join(service.Profile.Data, "test-local.png")
	require.NoError(t, os.WriteFile(localFile, pngBytes, 0644))

	// Create attachment with StorageType LOCAL and empty Blob
	attachment, err := service.Store.CreateAttachment(context.Background(), &store.Attachment{
		UID:         shortuuid.New(),
		CreatorID:   1,
		Filename:    "test-local.png",
		Reference:   "test-local.png",
		StorageType: storepb.AttachmentStorageType_LOCAL,
		Size:        int64(len(pngBytes)),
		Type:        "image/png",
	})
	require.NoError(t, err)

	entry := &storepb.MemoPayload_LinkMetadata{
		Url:                "https://example.com/local",
		CoverAttachmentUid: attachment.UID,
	}
	service.backfillCoverDimensions(context.Background(), entry)
	require.Equal(t, int32(1), entry.CoverWidth)
	require.Equal(t, int32(1), entry.CoverHeight)
}

func TestRetryLinkContextCanceledDoesNotIncrementFailure(t *testing.T) {
	service := newLinkEnrichmentTestService(t, stubFetchResults{})
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // canceled context

	entry := &storepb.MemoPayload_LinkMetadata{
		Url:           "https://example.com/canceled",
		FetchAttempts: 1,
	}
	service.retryLink(ctx, 1, entry, time.Now())
	require.Equal(t, int32(1), entry.FetchAttempts, "canceled context should not increment fetch attempts")
}

package v1

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	_ "golang.org/x/image/webp"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// maxEnrichLinksPerMemo bounds how many links a single create/update
	// enriches, so memo writes stay fast on link-heavy content.
	maxEnrichLinksPerMemo = 5
	// enrichTimeout bounds the whole metadata+cover pass.
	enrichTimeout       = 10 * time.Second
	coverFilenamePrefix = "link-cover-"
	// retryWindow caps link fetch retries at 24h after the first failure.
	retryWindow = 24 * time.Hour
)

// retryDelays is the backoff schedule between fetch attempts; later attempts
// keep the last (8h) delay.
var retryDelays = []time.Duration{5 * time.Minute, 15 * time.Minute, 30 * time.Minute, time.Hour, 2 * time.Hour, 4 * time.Hour, 8 * time.Hour}

func backoffDelay(attempts int32) time.Duration {
	if attempts <= 1 {
		return retryDelays[0]
	}
	if int(attempts) > len(retryDelays) {
		return retryDelays[len(retryDelays)-1]
	}
	return retryDelays[attempts-1]
}

// linkMetadataPending reports whether the entry still needs a fetch: either the
// metadata fetch itself never succeeded, or it succeeded but the cover image is
// not cached yet.
func linkMetadataPending(entry *storepb.MemoPayload_LinkMetadata) bool {
	if entry.Title == "" && entry.Description == "" && entry.Image == "" {
		// Full failure placeholder. Ambiguous with a page that legitimately has
		// no metadata — bounded by retryWindow, so harmless.
		return true
	}
	return entry.Image != "" && entry.CoverAttachmentUid == ""
}

// prepareRetry decides whether a pending entry may be retried now. Entries
// persisted before retry bookkeeping (all retry fields zero) get a fresh 24h
// window due immediately — otherwise they would read as exhausted in 1970.
func prepareRetry(entry *storepb.MemoPayload_LinkMetadata, now time.Time) bool {
	if entry.FirstAttemptAt == 0 {
		entry.FetchAttempts = 1
		entry.FirstAttemptAt = now.Unix()
		entry.LastAttemptAt = 0
		return true
	}
	if now.Sub(time.Unix(entry.FirstAttemptAt, 0)) >= retryWindow {
		return false
	}
	return now.Unix() >= entry.LastAttemptAt+int64(backoffDelay(entry.FetchAttempts)/time.Second)
}

func recordRetryFailure(entry *storepb.MemoPayload_LinkMetadata, now time.Time) {
	entry.FetchAttempts++
	entry.LastAttemptAt = now.Unix()
}

func clearRetryState(entry *storepb.MemoPayload_LinkMetadata) {
	entry.FetchAttempts = 0
	entry.FirstAttemptAt = 0
	entry.LastAttemptAt = 0
}

// decodeImageBounds reads image dimensions from a blob. The standard registry
// covers jpeg/png/gif; webp registers via golang.org/x/image (already in go.mod).
func decodeImageBounds(blob []byte) (int32, int32) {
	config, _, err := image.DecodeConfig(bytes.NewReader(blob))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return 0, 0
	}
	return int32(config.Width), int32(config.Height)
}

// EnrichMemoLinks fetches and persists metadata (plus a locally cached cover
// image) for the links in the memo content. Failures never propagate: a link
// that cannot be enriched is skipped, and a memo write is never blocked.
// The caller must have run RebuildMemoPayload first.
func (s *APIV1Service) EnrichMemoLinks(ctx context.Context, memo *store.Memo) {
	if memo == nil || memo.Payload == nil || s.linkMetadataFetcher == nil {
		return
	}
	data, err := s.MarkdownService.ExtractAll([]byte(memo.Content))
	if err != nil {
		return
	}
	links := data.Links
	if len(links) > maxEnrichLinksPerMemo {
		links = links[:maxEnrichLinksPerMemo]
	}

	enrichCtx, cancel := context.WithTimeout(ctx, enrichTimeout)
	defer cancel()
	now := time.Now()

	// Reuse existing entries so edits do not refetch unchanged links.
	existing := make(map[string]*storepb.MemoPayload_LinkMetadata, len(memo.Payload.Links))
	for _, entry := range memo.Payload.Links {
		existing[entry.Url] = entry
	}

	enriched := make([]*storepb.MemoPayload_LinkMetadata, 0, len(links))
	for _, url := range links {
		entry, ok := existing[url]
		if !ok {
			entry = s.enrichLink(enrichCtx, memo.CreatorID, url, now)
			if entry == nil {
				// First failure: persist a placeholder so retry state survives;
				// the card renders its plain-link fallback for title-less entries.
				entry = &storepb.MemoPayload_LinkMetadata{
					Url:            url,
					FetchAttempts:  1,
					FirstAttemptAt: now.Unix(),
					LastAttemptAt:  now.Unix(),
				}
			}
			enriched = append(enriched, entry)
			continue
		}
		// Covers cached before dimension bookkeeping: backfill from the stored blob so
		// aspect-aware tiles work for existing bookmarks without re-fetching anything.
		if entry.CoverAttachmentUid != "" && (entry.CoverWidth == 0 || entry.CoverHeight == 0) {
			s.backfillCoverDimensions(enrichCtx, entry)
		}
		if linkMetadataPending(entry) && prepareRetry(entry, now) {
			s.retryLink(enrichCtx, memo.CreatorID, entry, now)
		}
		enriched = append(enriched, entry)
	}
	memo.Payload.Links = enriched
}

// RefreshMemoLinkCovers retries cover fetching for the caller's link memos that have
// no cached cover, ignoring the backoff schedule (a fresh zero-value window makes the
// retry due immediately). Paged in both directions: bounded memos per call and bounded
// links per memo so one click stays snappy — call repeatedly to work through a backlog.
// ponytail: no continuation token; memos_examined < page size tells the client it is done.
const refreshLinkCoversMemosPerPage = 200

func (s *APIV1Service) RefreshMemoLinkCovers(ctx context.Context, _ *v1pb.RefreshMemoLinkCoversRequest) (*v1pb.RefreshMemoLinkCoversResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	limit := refreshLinkCoversMemosPerPage
	memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
		CreatorID: &user.ID,
		Filters:   []string{"has_link"},
		Limit:     &limit,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	response := &v1pb.RefreshMemoLinkCoversResponse{MemosExamined: int32(len(memos))}
	now := time.Now()
	for _, memo := range memos {
		if memo.Payload == nil {
			continue
		}
		changed := false
		for _, entry := range memo.Payload.Links {
			if entry.CoverAttachmentUid != "" {
				continue
			}
			if entry.Image == "" {
				// No og:image to fetch; still retry metadata in case one appears.
				if entry.Title == "" && entry.Description == "" {
					clearRetryState(entry)
					s.retryLink(ctx, user.ID, entry, now)
					changed = true
				}
				response.SkippedLinks++
				continue
			}
			clearRetryState(entry)
			s.retryLink(ctx, user.ID, entry, now)
			changed = true
			if entry.CoverAttachmentUid != "" {
				response.UpdatedLinks++
			} else {
				response.FailedLinks++
			}
		}
		if changed {
			if err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Payload: memo.Payload}); err != nil {
				slog.Warn("failed to persist refreshed link covers", "memoID", memo.ID, "err", err)
			}
		}
	}
	return response, nil
}

// backfillCoverDimensions decodes the stored cover blob to fill missing dimensions.
// Cheap (header-only decode) and safe to repeat — a failed decode just leaves zeros.
func (s *APIV1Service) backfillCoverDimensions(ctx context.Context, entry *storepb.MemoPayload_LinkMetadata) {
	uid := entry.CoverAttachmentUid
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid, GetBlob: true})
	if err != nil || attachment == nil {
		return
	}
	entry.CoverWidth, entry.CoverHeight = decodeImageBounds(attachment.Blob)
}

// retryLink re-attempts a pending entry in place: full fetch when the metadata
// itself failed, cover-only when metadata is present but the image is not cached.
func (s *APIV1Service) retryLink(ctx context.Context, creatorID int32, entry *storepb.MemoPayload_LinkMetadata, now time.Time) {
	if entry.Title == "" && entry.Description == "" && entry.Image == "" {
		meta, err := s.linkMetadataFetcher.Get(ctx, entry.Url)
		if err != nil {
			slog.Warn("link metadata retry failed", "url", entry.Url, "err", err)
			recordRetryFailure(entry, now)
			return
		}
		entry.Title = meta.Title
		entry.Description = meta.Description
		entry.Image = meta.Image
	}
	if entry.Image != "" {
		if uid, width, height := s.cacheLinkCover(ctx, creatorID, entry.Url, entry.Image); uid != "" {
			entry.CoverAttachmentUid = uid
			entry.CoverWidth = width
			entry.CoverHeight = height
		} else {
			recordRetryFailure(entry, now)
			return
		}
	}
	clearRetryState(entry)
}

func (s *APIV1Service) enrichLink(ctx context.Context, creatorID int32, url string, now time.Time) *storepb.MemoPayload_LinkMetadata {
	meta, err := s.linkMetadataFetcher.Get(ctx, url)
	if err != nil {
		slog.Warn("failed to enrich link metadata", "url", url, "err", err)
		return nil
	}
	entry := &storepb.MemoPayload_LinkMetadata{
		Url:         url,
		Title:       meta.Title,
		Description: meta.Description,
		Image:       meta.Image,
	}
	if meta.Image != "" {
		if uid, width, height := s.cacheLinkCover(ctx, creatorID, url, meta.Image); uid != "" {
			entry.CoverAttachmentUid = uid
			entry.CoverWidth = width
			entry.CoverHeight = height
		} else {
			// Cover fetch failed on the first attempt: start the retry window.
			entry.FetchAttempts = 1
			entry.FirstAttemptAt = now.Unix()
			entry.LastAttemptAt = now.Unix()
		}
	}
	return entry
}

// cacheLinkCover stores the cover image as a standalone user attachment,
// deduplicated by URL. Covers are intentionally not bound to the memo: they
// are shared across memos that reference the same URL, at the cost of not
// cascading on memo delete.
// ponytail: no GC for orphaned link-cover-* attachments; add a cleanup pass
// if storage pressure ever matters.
func (s *APIV1Service) cacheLinkCover(ctx context.Context, creatorID int32, pageURL string, imageURL string) (uid string, width int32, height int32) {
	filename := coverFilename(pageURL, imageURL)
	limit := 1
	found, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		Filename:  &filename,
		CreatorID: &creatorID,
		Limit:     &limit,
	})
	if err != nil {
		slog.Warn("failed to look up cached link cover", "filename", filename, "err", err)
	} else if len(found) > 0 {
		width, height = decodeImageBounds(found[0].Blob)
		return found[0].UID, width, height
	}

	image, err := s.linkMetadataFetcher.GetImage(ctx, imageURL)
	if err != nil {
		slog.Warn("failed to fetch link cover image", "url", imageURL, "err", err)
		return "", 0, 0
	}

	create := &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: creatorID,
		Filename:  filename,
		Blob:      image.Blob,
		Type:      image.Mediatype,
		Size:      int64(len(image.Blob)),
	}
	if err := SaveAttachmentBlob(ctx, s.Profile, s.Store, create); err != nil {
		slog.Warn("failed to save link cover blob", "filename", filename, "err", err)
		return "", 0, 0
	}
	created, err := s.Store.CreateAttachment(ctx, create)
	if err != nil {
		slog.Warn("failed to create link cover attachment", "filename", filename, "err", err)
		return "", 0, 0
	}
	width, height = decodeImageBounds(image.Blob)
	return created.UID, width, height
}

func coverFilename(pageURL string, imageURL string) string {
	sum := sha1.Sum([]byte(pageURL + "\x00" + imageURL))
	base := coverFilenamePrefix + hex.EncodeToString(sum[:])[:16]
	ext := filepath.Ext(strings.TrimSuffix(strings.SplitN(imageURL, "?", 2)[0], "/"))
	if ext == "" {
		ext = ".jpg"
	}
	return base + ext
}

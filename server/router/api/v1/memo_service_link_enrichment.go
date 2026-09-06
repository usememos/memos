package v1

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log/slog"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/lithammer/shortuuid/v4"
	_ "golang.org/x/image/webp"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

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
	retryWindow       = 24 * time.Hour
	maxCoverBlobBytes = 5 << 20
)

func fetchErrorCategory(ctx context.Context, err error) string {
	if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
		return "cancelled"
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return "timeout"
	}
	return "fetch_failed"
}

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
	if entry.FirstAttemptAt == 0 {
		entry.FirstAttemptAt = now.Unix()
	}
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
		if linkMetadataPending(entry) && prepareRetry(entry, now) {
			s.retryLink(enrichCtx, memo.CreatorID, entry, now)
		}
		enriched = append(enriched, entry)
	}
	memo.Payload.Links = enriched
}

// RefreshMemoLinkCovers retries cover fetching for the caller's link memos that have
// no cached cover, ignoring the backoff schedule (a fresh zero-value window makes the
// retry due immediately). Entries that already have a cached cover are skipped.
// Paged in both directions: bounded memos per call and bounded links per memo so one
// click stays snappy — call repeatedly to work through a backlog.
// Memos within a page are processed concurrently by a bounded worker pool, since each
// link fetch is I/O-bound (outbound HTTP for metadata + image download).
const (
	refreshLinkCoversMemosPerPage = 200
	refreshLinkCoversWorkers      = 10
)

func (s *APIV1Service) RefreshMemoLinkCovers(ctx context.Context, req *v1pb.RefreshMemoLinkCoversRequest) (*v1pb.RefreshMemoLinkCoversResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	memos, nextPageToken, err := s.refreshMemosPage(ctx, user.ID, req)
	if err != nil {
		return nil, err
	}

	response := &v1pb.RefreshMemoLinkCoversResponse{MemosExamined: int32(len(memos)), NextPageToken: nextPageToken}
	now := time.Now()

	var updated, failed, skipped int32
	group, refreshCtx := errgroup.WithContext(ctx)
	group.SetLimit(refreshLinkCoversWorkers)

	for _, memo := range memos {
		if memo.Payload == nil {
			continue
		}
		if refreshCtx.Err() != nil {
			break
		}
		group.Go(func() error {
			changed := false
			var memoUpdated, memoFailed, memoSkipped int32
			for _, entry := range memo.Payload.Links {
				if err := refreshCtx.Err(); err != nil {
					return err
				}
				if entry.CoverAttachmentUid != "" {
					if s.linkCoverHealthy(refreshCtx, user.ID, entry.CoverAttachmentUid) {
						memoSkipped++
						continue
					}
					if s.repairLinkCover(refreshCtx, user.ID, entry) {
						memoUpdated++
					} else {
						memoFailed++
					}
					changed = true
					continue
				}
				clearRetryState(entry)
				if entry.Image != "" {
					if !s.repairLinkCover(refreshCtx, user.ID, entry) && refreshCtx.Err() == nil {
						recordRetryFailure(entry, now)
					}
				} else {
					s.retryLink(refreshCtx, user.ID, entry, now)
				}
				if err := refreshCtx.Err(); err != nil {
					return err
				}
				changed = true
				switch {
				case entry.CoverAttachmentUid != "":
					memoUpdated++
				case entry.FetchAttempts > 0:
					memoFailed++
				default:
					memoSkipped++
				}
			}
			if changed {
				if err := s.Store.UpdateMemo(refreshCtx, &store.UpdateMemo{
					ID: memo.ID, Payload: memo.Payload, ExpectedContent: &memo.Content, ExpectedPayload: &memo.PayloadRaw,
				}); err != nil {
					if errors.Is(err, store.ErrMemoConcurrentUpdate) {
						atomic.AddInt32(&skipped, int32(len(memo.Payload.Links)))
						return nil
					}
					slog.Warn("failed to persist refreshed link covers", "memoID", memo.ID, "category", "persist_failed")
					return status.Errorf(codes.Internal, "failed to persist refreshed link covers")
				}
			}
			atomic.AddInt32(&updated, memoUpdated)
			atomic.AddInt32(&failed, memoFailed)
			atomic.AddInt32(&skipped, memoSkipped)
			return nil
		})
	}
	err = group.Wait()
	if ctx.Err() != nil {
		return nil, status.FromContextError(ctx.Err()).Err()
	}
	if err != nil {
		return nil, err
	}

	response.UpdatedLinks = updated
	response.FailedLinks = failed
	response.SkippedLinks = skipped
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
	if attachment.Payload != nil && attachment.Payload.GetMediaMetadata() != nil {
		mm := attachment.Payload.GetMediaMetadata()
		if mm.GetWidth() > 0 && mm.GetHeight() > 0 {
			entry.CoverWidth = mm.GetWidth()
			entry.CoverHeight = mm.GetHeight()
			return
		}
	}
	blob, err := s.GetAttachmentBlob(ctx, attachment)
	if err != nil || len(blob) == 0 {
		return
	}
	entry.CoverWidth, entry.CoverHeight = decodeImageBounds(blob)
}

// retryLink re-attempts a pending entry in place: it re-fetches metadata when the
// entry has no image URL (a page may have added an og:image since the last fetch),
// then caches the cover image when one is available.
func (s *APIV1Service) retryLink(ctx context.Context, creatorID int32, entry *storepb.MemoPayload_LinkMetadata, now time.Time) {
	if entry.Image == "" {
		meta, err := s.linkMetadataFetcher.Get(ctx, entry.Url)
		if err != nil {
			if errors.Is(err, context.Canceled) || ctx.Err() != nil {
				return
			}
			slog.Warn("link metadata retry failed", "category", fetchErrorCategory(ctx, err))
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
			if ctx.Err() != nil {
				return
			}
			recordRetryFailure(entry, now)
			return
		}
	}
	clearRetryState(entry)
}

func (s *APIV1Service) enrichLink(ctx context.Context, creatorID int32, url string, now time.Time) *storepb.MemoPayload_LinkMetadata {
	meta, err := s.linkMetadataFetcher.Get(ctx, url)
	if err != nil {
		slog.Warn("failed to enrich link metadata", "category", fetchErrorCategory(ctx, err))
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
	return s.cacheLinkCoverCandidate(ctx, creatorID, pageURL, imageURL, false)
}

func (s *APIV1Service) cacheLinkCoverCandidate(ctx context.Context, creatorID int32, pageURL string, imageURL string, repair bool) (uid string, width int32, height int32) {
	filename := coverFilename(pageURL, imageURL)
	limit := 1
	found, err := s.Store.ListAttachments(ctx, &store.FindAttachment{Filename: &filename, CreatorID: &creatorID, Limit: &limit})
	if err != nil {
		slog.Warn("failed to look up cached link cover", "operation", "cover_lookup")
	} else if len(found) > 0 && !repair {
		existing := found[0]
		if existing.Payload != nil && existing.Payload.GetMediaMetadata() != nil {
			mm := existing.Payload.GetMediaMetadata()
			if mm.GetWidth() > 0 && mm.GetHeight() > 0 {
				return existing.UID, mm.GetWidth(), mm.GetHeight()
			}
		}
		return existing.UID, width, height
	}

	image, err := s.linkMetadataFetcher.GetImage(ctx, imageURL)
	if err != nil {
		slog.Warn("failed to fetch link cover image", "category", fetchErrorCategory(ctx, err))
		return "", 0, 0
	}
	validationCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.coverValidationSemaphore.Acquire(validationCtx, 1); err != nil {
		return "", 0, 0
	}
	width, height, err = validateLinkCover(image.Blob)
	s.coverValidationSemaphore.Release(1)
	if err != nil || validationCtx.Err() != nil {
		return "", 0, 0
	}
	create := &store.Attachment{
		UID:       shortuuid.New(),
		CreatorID: creatorID,
		Filename:  filename,
		Blob:      image.Blob,
		Type:      image.Mediatype,
		Size:      int64(len(image.Blob)),
		Payload: &storepb.AttachmentPayload{
			MediaMetadata: &storepb.MediaMetadata{
				Width:  proto.Int32(width),
				Height: proto.Int32(height),
			},
		},
	}
	var saveErr error
	if repair {
		saveErr = saveLinkCoverCandidateBlob(ctx, s.Profile, s.Store, create)
	} else {
		saveErr = SaveAttachmentBlob(ctx, s.Profile, s.Store, create)
	}
	if saveErr != nil {
		slog.Warn("failed to save link cover blob", "operation", "cover_store")
		return "", 0, 0
	}
	created, err := s.Store.CreateAttachment(ctx, create)
	if err != nil {
		slog.Warn("failed to create link cover attachment", "operation", "cover_create")
		return "", 0, 0
	}
	return created.UID, width, height
}

func validateLinkCover(blob []byte) (int32, int32, error) {
	if len(blob) > maxCoverBlobBytes {
		return 0, 0, errors.New("cover exceeds byte limit")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(blob))
	if err != nil {
		return 0, 0, errors.New("invalid cover header")
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > 4096 || config.Height > 4096 || config.Width > 8_000_000/config.Height {
		return 0, 0, errors.New("cover exceeds dimension limit")
	}
	if format != "jpeg" && format != "png" && format != "webp" {
		return 0, 0, errors.New("unsupported cover format")
	}
	if animatedLinkCover(blob, format) {
		return 0, 0, errors.New("animated cover format is unsupported")
	}
	decoded, _, err := image.Decode(bytes.NewReader(blob))
	if err != nil {
		return 0, 0, errors.New("invalid cover pixels")
	}
	if decoded.Bounds().Dx() != config.Width || decoded.Bounds().Dy() != config.Height {
		return 0, 0, errors.New("cover dimensions mismatch")
	}
	return int32(config.Width), int32(config.Height), nil
}

func (s *APIV1Service) linkCoverHealthy(ctx context.Context, creatorID int32, uid string) bool {
	attachment, err := s.Store.GetAttachment(ctx, &store.FindAttachment{UID: &uid, CreatorID: &creatorID})
	if err != nil || attachment == nil {
		return false
	}
	validationCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := s.coverValidationSemaphore.Acquire(validationCtx, 1); err != nil {
		return false
	}
	defer s.coverValidationSemaphore.Release(1)
	blob, err := s.readLinkCoverBlob(validationCtx, attachment)
	if err != nil || validationCtx.Err() != nil {
		return false
	}
	_, _, err = validateLinkCover(blob)
	return err == nil && validationCtx.Err() == nil
}

func (s *APIV1Service) repairLinkCover(ctx context.Context, creatorID int32, entry *storepb.MemoPayload_LinkMetadata) bool {
	uid, width, height := s.cacheLinkCoverCandidate(ctx, creatorID, entry.Url, entry.Image, true)
	if uid == "" {
		meta, err := s.linkMetadataFetcher.GetFresh(ctx, entry.Url)
		if err != nil || meta == nil || meta.Image == "" || meta.Image == entry.Image {
			return false
		}
		uid, width, height = s.cacheLinkCoverCandidate(ctx, creatorID, entry.Url, meta.Image, true)
		if uid == "" {
			return false
		}
		entry.Image = meta.Image
	}
	entry.CoverAttachmentUid, entry.CoverWidth, entry.CoverHeight = uid, width, height
	clearRetryState(entry)
	return true
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

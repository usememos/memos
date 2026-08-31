package v1

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"

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
)

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

	// Reuse existing entries so edits do not refetch unchanged links.
	existing := make(map[string]*storepb.MemoPayload_LinkMetadata, len(memo.Payload.Links))
	for _, entry := range memo.Payload.Links {
		existing[entry.Url] = entry
	}

	enriched := make([]*storepb.MemoPayload_LinkMetadata, 0, len(links))
	for _, url := range links {
		if entry, ok := existing[url]; ok {
			enriched = append(enriched, entry)
			continue
		}
		entry := s.enrichLink(enrichCtx, memo.CreatorID, url)
		if entry != nil {
			enriched = append(enriched, entry)
		}
	}
	memo.Payload.Links = enriched
}

func (s *APIV1Service) enrichLink(ctx context.Context, creatorID int32, url string) *storepb.MemoPayload_LinkMetadata {
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
		if uid := s.cacheLinkCover(ctx, creatorID, url, meta.Image); uid != "" {
			entry.CoverAttachmentUid = uid
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
func (s *APIV1Service) cacheLinkCover(ctx context.Context, creatorID int32, pageURL string, imageURL string) string {
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
		return found[0].UID
	}

	image, err := s.linkMetadataFetcher.GetImage(ctx, imageURL)
	if err != nil {
		slog.Warn("failed to fetch link cover image", "url", imageURL, "err", err)
		return ""
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
		return ""
	}
	created, err := s.Store.CreateAttachment(ctx, create)
	if err != nil {
		slog.Warn("failed to create link cover attachment", "filename", filename, "err", err)
		return ""
	}
	return created.UID
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

# Bento Aspect-Ratio Tiles

Status: Implemented

> Superseded in part: after user feedback that hand-rolled packing misbehaved, the grid
> was rebuilt on react-photo-album's RowsPhotoAlbum (justified rows from aspect ratios).
> memoVisualAspect and the server-side cover dimensions from this plan feed the album
> unchanged; the custom span math was removed.

> Deviations: MemoView needed no change — the bento tile already renders covers
> full-bleed with object-cover, and the new spans alone drive tile shape. The backfill
> runs inside EnrichMemoLinks (cover uid present, dims zero → header-decode the stored
> blob) instead of separate runner code — the RunLoop's 15m pass drives it either way.

> Review pass: corrected the provenance of attachment dims (they are extracted by the
> web uploader and sent as MediaMetadata — `mediaMetadataService.ts` — then validated
> server-side, not recorded by the server on upload; API/legacy uploads fall back to the
> estimator), confirmed the webp gap is real and pre-known in this codebase
> (`attachment_service_image.go:80-82`), and pinned the fix to `golang.org/x/image/webp`
> v0.45.0 which is already in go.mod via imaging. Verified LinkMetadata fields 9-10 are
> free, `FindAttachment.GetBlob` supports the backfill, and estimator constants live at
> `memoCardHeight.ts:24-25`.

## Goal

Bento tiles adapt to the actual shape of their media: portrait photos get tall tiles,
landscape shots get wide tiles, squares stay compact. Today `bentoSpan` guesses tile
height from a text-length estimator and treats every visual memo identically
(`colSpan 2, rowSpan >= 2`), so images get cropped to whatever shape the guess produced.

## Library verdict (user asked about shadcn)

**No new component.** Verified: the repo already has shadcn wiring
(`web/components.json`) and our bento grid is 60 lines of CSS Grid that already works.
Shadcn has no feed-grid component; third-party registries (magicui bento) ship
static marketing blocks, not aspect-driven feed tiles. The real work is *knowing image
dimensions*, which is data plumbing, not a component problem. Adding a dependency here
would still require everything in this plan.

## What we already have (verified)

- **Attachment dimensions exist end to end, client-supplied**: the web uploader
  extracts `width`/`height` (EXIF header or decode —
  `MemoEditor/services/mediaMetadataService.ts`) and sends them as `MediaMetadata`;
  the server validates (`validateClientMediaMetadata`) and returns them via
  `convertAttachmentFromStore` → `Attachment.MediaMetadata`. So coverage = memos saved
  through the web editor; API-uploaded or legacy attachments without metadata fall back
  to the estimator (verified `store.FindAttachment` has `GetBlob` for any later backfill).
- **Link covers do not**: `cacheLinkCover` stores the blob without decoding bounds;
  `LinkMetadata` (store proto) has no width/height fields.
- The height estimator (`memoCardHeight.ts`) hardcodes `SINGLE_IMAGE_HEIGHT` and a fixed
  video aspect — it is the guessing layer this plan replaces where real dims exist.

## Design

### 1. Span from aspect ratio (attachments, client-only)

New helper in `BentoGrid/bentoSpan.ts` (replacing the featured/estimator path for
visual memos when dims are known):

```
aspect = width / height   (from the first visual attachment with both set)
landscape (aspect > 1.2): colSpan 2, rowSpan = ceil((2*colWidth + gap) / aspect / rowUnit)
square    (0.8–1.2):      colSpan 2, rowSpan = ceil(colWidth*2 / rowUnit) ≈ 2
portrait  (aspect < 0.8): colSpan 1, rowSpan = ceil(colWidth / aspect / rowUnit), cap 3
```

Text header/footer still contribute: `rowSpan = max(aspectSpan, estimatorSpan)` — keeps
long text from clipping while letting the image drive the shape. Missing dims → today's
estimator fallback unchanged.

### 2. Link covers: record dims at cache time (server, tiny)

- `cacheLinkCover` decodes bounds with stdlib `image.DecodeConfig` on the already-fetched
  blob (~5 lines, no dep).
- `LinkMetadata` store proto gains `int32 cover_width = 9; int32 cover_height = 10;`
  (compatible additions, same pattern as the retry fields just shipped).
  `convertMemoLinksFromStore` passes them through; the API `LinkMetadata` message needs
  the same two fields (additive, `buf generate` covers Go+TS+OpenAPI).
- Backfill: covers cached before this have no dims — the runner (`RunLoop`, 15m) can
  decode the stored blob on its existing pass and fill the fields (reuse the retry
  branch: cover uid present but dims zero → decode from blob, update payload).
- Bento side: link-cover tiles consume dims exactly like attachments (step 1);
  zero dims → estimator fallback as today.

### 3. Rendering

`MemoView` bento variant: the cover/attachment `<img>` keeps `object-cover` but the tile
height now matches the image shape (from the span), so cropping becomes minimal instead
of arbitrary. No layout system change; `gridAutoRows` and dense packing stay.

## Files

| File | Change |
| --- | --- |
| `web/src/components/BentoGrid/bentoSpan.ts` | aspect-driven spans for visual memos, estimator fallback |
| `web/src/components/MemoView/MemoView.tsx` | bento tile renders image at the span-implied aspect |
| `server/router/api/v1/memo_service_link_enrichment.go` | `image.DecodeConfig` at cover cache time; runner backfill branch |
| `proto/store/memo.proto`, `proto/api/v1/memo_service.proto` | LinkMetadata cover_width/cover_height; `buf generate` |
| `server/router/api/v1/memo_service_converter.go` | pass dims through convertMemoLinksFromStore |
| `web/tests/bento-span.test.ts` | portrait/landscape/square spans, missing-dims fallback |
| `server/router/api/v1/memo_service_link_enrichment_test.go` | dims recorded at cache time |

## Phases

1. Client aspect spans for attachments (dims already flow) + tests — ships the visible
   win with zero server change.
2. Server cover dims (proto + decode + converter + backfill) + tests + `buf lint`.
3. Gates: `pnpm lint && pnpm test && pnpm build`, `go build ./...`,
   `go test -race ./server/...` (known unrelated TestDetectAttachmentMimeType flake).

## Risks

- **Layout shift on resize**: spans recompute with column width — already true today;
  deterministic, no async measurement (no `naturalWidth` reflow hacks).
- Videos without metadata or exotic rotations → estimator fallback, unchanged from today.
- `image.DecodeConfig` needs registered formats — import `image/jpeg`/`image/png`/`image/gif`
  side-effects in the enrichment file. **WebP is common for og covers and is NOT in the
  stdlib registry** (the codebase already hit this: `attachment_service_image.go:80-82`
  comment). Register `golang.org/x/image/webp` — v0.45.0 is already in `go.mod` (indirect
  via `disintegration/imaging`), so this promotes an existing module to direct, no new
  dependency.

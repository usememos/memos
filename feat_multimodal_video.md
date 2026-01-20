# Feature: Multimodal Video Support (Unified Attachment Approach)

**Status:** 🚀 IN DEVELOPMENT (January 2026)  
**Date Created:** January 15, 2026  
**Owner:** Claude AI Agent  
**Complexity:** Medium (7-11 days estimated)  
**Target Implementation Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 (optional)

## Quick Start for Claude Implementation

1. **Run Phase 1 First** (Backend foundation): Create proto definitions, add store models
2. **Then Phase 2** (Frontend): Build VideoPreview with controls
3. **Then Phase 3**: Add MIME type detection
4. **Then Phase 4**: Markdown integration
5. **Skip Phase 5** unless explicitly requested

**Do NOT skip phases or implement them out of order.** Each phase depends on the previous.

---

## Overview

Extend the existing inline attachment preview system to provide **native video handling with advanced playback controls, metadata extraction, and streaming capabilities**. This feature builds upon the already-implemented attachment preview infrastructure to add specialized video support without fragmenting the attachment system.

---

## Problem Statement

Currently, Memos supports only local file attachments (images, videos, documents). Users cannot:

- Preview videos inline with standard playback controls
- Access video metadata (duration, resolution, codec)
- Seek within large videos efficiently (streaming)
- Share video links with timestamps

---

## Architecture Decision: Unified Attachment Approach

We extend the existing `Attachment` model (not create a separate system) to include optional `VideoMetadata`. This maintains:

1. **Consistency**: Uses `AttachmentList` and `InlineAttachmentPreview` components
2. **Maintainability**: Single code path for all attachments
3. **User Experience**: Same preview modal for all types
4. **Performance**: Shared caching and loading logic

---

## Phase 1: Backend Foundation (2-3 days)

### Prerequisite: Understand Current Attachment Flow

**BEFORE IMPLEMENTING:**

1. Read `store/attachment.go` to understand `Attachment` struct
2. Read `proto/api/v1/attachment.proto` to understand proto definition
3. Understand how attachments are currently fetched in `server/router/api/v1/attachment_service.go`

### 1.1 Extend Proto Definition

**File**: `proto/api/v1/attachment.proto`

**What to do**:

- Add new `VideoMetadata` message (see example below)
- Add optional `VideoMetadata video_metadata = 12;` field to `Attachment` message
- Run `cd proto && buf generate` to regenerate Go and TypeScript code

**Proto Changes**:

```protobuf
// Add this new message
message VideoMetadata {
  int64 duration_ms = 1;      // Total duration in milliseconds
  int32 width = 2;             // Video width in pixels
  int32 height = 3;            // Video height in pixels
  float fps = 4;               // Frames per second
  string codec = 5;            // Video codec (h264, vp9, etc.)
  int64 bit_rate = 6;          // Bitrate in bps
  string format = 7;           // Container format
  string thumbnail_url = 8;    // URL to generated thumbnail
}

// Modify existing Attachment message by adding:
// video_metadata field to existing Attachment message
```

**After modification, run**:

```bash
cd proto && buf generate
```

**Expected output**:

- New `proto/gen/api/v1/` Go files updated
- New `web/src/types/proto/api/v1/` TypeScript files generated

### 1.2 Update Go Store Model

**File**: `store/attachment.go`

**What to do**:

- Add `VideoMetadata` struct matching proto definition
- Add `VideoMetadata *VideoMetadata` field to `Attachment` struct
- Add helper function `isVideoMimeType(mimeType string) bool`

**Exact locations to modify**:

1. Find the existing `type Attachment struct` and add the new field
2. Add new `type VideoMetadata struct` above the `Attachment` struct

**Required struct fields**:

```go
type VideoMetadata struct {
    DurationMs   int64
    Width        int32
    Height       int32
    FPS          float32
    Codec        string
    BitRate      int64
    Format       string
    ThumbnailURL string
}
```

### 1.3 Create Video Metadata Extraction Service

**File**: `plugin/httpgetter/video_metadata.go` (NEW FILE)

**What this does**: Provides functions to extract video metadata using `ffprobe` command-line tool.

**Implementation requirements**:

- Function `ExtractVideoMetadata(ctx context.Context, filePath string) (*VideoMetadata, error)`
  - Uses `ffprobe` JSON output to extract duration, dimensions, codec, fps, bitrate
  - Returns `nil, nil` if ffprobe not available (graceful degradation)
  - Returns `nil, err` if ffprobe fails on this specific file
  - **DO NOT block request processing** - extraction should be async/cached
- Function `GetVideoThumbnail(ctx context.Context, filePath string, offsetMs int64) ([]byte, error)`
  - Uses `ffmpeg` to extract single frame at offsetMs as JPEG
  - Returns raw JPEG bytes
  - Returns `nil, err` if ffmpeg fails

**Dependencies**:

- Uses only Go stdlib + `context` package
- Assumes `ffprobe` and `ffmpeg` are installed on system (do NOT add Go dependency)
- Use `exec.CommandContext()` for subprocess execution

**Error handling**:

- If `ffprobe` not found, log warning and return `nil, nil` (don't fail)
- If file is not a valid video, return `nil, ErrNotAValidVideo`

### 1.4 Integrate Metadata Extraction into Attachment Retrieval

**File**: `store/attachment.go` (modification to existing driver implementation)

**What to do**:

- Locate `GetAttachment()` method in the SQLite/MySQL/Postgres driver implementations
- After retrieving attachment, check if MIME type is `video/*`
- If video: call `httpgetter.ExtractVideoMetadata()` and populate `VideoMetadata` field
- If extraction fails, continue without metadata (don't block)

**Implementation approach**:

```go
// Pseudocode for driver implementations
func (d *sqliteDriver) GetAttachment(ctx context.Context, id string) (*Attachment, error) {
    // ...existing code to fetch from DB...

    // NEW: Extract video metadata if video type
    if attachment.MediaType != "" && strings.HasPrefix(attachment.MediaType, "video/") {
        metadata, _ := httpgetter.ExtractVideoMetadata(ctx, attachment.FilePath)
        // Only assign if extraction succeeds
        if metadata != nil {
            attachment.VideoMetadata = metadata
        }
    }

    return attachment, nil
}
```

**Apply this to ALL database drivers**:

- `store/db/sqlite/attachment.go`
- `store/db/mysql/attachment.go`
- `store/db/postgres/attachment.go`

### 1.5 HTTP Range Request Support (Video Streaming)

**File**: `server/router/fileserver/streaming.go` (NEW FILE)

**What this does**: Handles HTTP 206 Partial Content responses for video streaming so browsers can seek without downloading entire file.

**Implementation**:

- Function `ServeVideoWithStreaming(w http.ResponseWriter, r *http.Request, filePath string) error`
- Check for `Range` header in request
- If present: return HTTP 206 with requested byte range
- If absent: return entire file as HTTP 200
- Always set `Accept-Ranges: bytes` header

**Key headers to handle**:

- `Range: bytes=start-end` (request header)
- `Content-Range: bytes start-end/total` (response header)
- `Accept-Ranges: bytes` (response header)
- Status code: 206 for partial, 200 for full

**Use Go stdlib only**: `io.ReadSeeker`, `http.ServeContent()` (handles Range automatically!)

### 1.6 Integration Point

**File**: `server/router/fileserver/handler.go` (existing file)

**What to do**:

- Locate where files are currently served (likely in a GET handler)
- For video MIME types, use new `ServeVideoWithStreaming()` instead of direct file serving
- Non-video files continue using existing logic

---

## Phase 2: Frontend VideoPreview Component (3-4 days)

### Prerequisite: Understand Current VideoPreview

**BEFORE IMPLEMENTING:**

1. Find and read `web/src/components/attachment/previews/VideoPreview.tsx`
2. Understand how `InlineAttachmentPreview` modal works
3. Check `web/src/hooks/useMemoQueries.ts` to see how attachments are fetched

### 2.1 Enhanced VideoPreview Component

**File**: `web/src/components/attachment/previews/VideoPreview.tsx` (MODIFY EXISTING)

**What this does**: Replace basic video player with full-featured HTML5 video player.

**Required features**:

1. **Playback Controls**:

   - Play/Pause button (shows current state)
   - Progress bar with timeline seeking
   - Current time / Total duration display
   - Volume slider + mute button

2. **Advanced Controls**:

   - Playback rate dropdown: 0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
   - Fullscreen button (uses Fullscreen API)
   - Picture-in-Picture button (PiP)
   - Settings button (for future subtitle/quality options)

3. **Keyboard Shortcuts**:

   - `Space`: Play/Pause
   - `→`: Seek +5 seconds
   - `←`: Seek -5 seconds
   - `↑`: Volume +10%
   - `↓`: Volume -10%
   - `M`: Mute/Unmute
   - `F`: Toggle fullscreen
   - `P`: Toggle Picture-in-Picture

4. **Metadata Display** (if provided):

   - Show duration, resolution, codec from `metadata` prop
   - Display in corner or collapsible panel

5. **Mobile Responsiveness**:
   - Touch-friendly hit targets (minimum 44px)
   - Simplified controls on small screens
   - Auto-hide controls after 3 seconds of inactivity

**Component Props**:

```typescript
interface VideoPreviewProps {
  src: string; // Video file URL
  filename: string; // Display name
  metadata?: VideoMetadata; // Optional metadata from server
  fileSize?: number; // File size in bytes
}
```

**State to manage**:

- `isPlaying`: boolean
- `currentTime`: number (seconds)
- `duration`: number (seconds)
- `volume`: number (0-1)
- `playbackRate`: number (0.25-2)
- `isFullscreen`: boolean
- `showControls`: boolean
- `buffered`: TimeRanges (for buffering indicator)
- `canPlay`: boolean (browser support check)

**Key implementation details**:

- Use `useRef` for `<video>` element
- Use `useEffect` for event listeners (play, pause, timeupdate, etc.)
- Use `useCallback` for control handlers to prevent re-renders
- Clean up event listeners in cleanup function
- Debounce control auto-hide (3 seconds of inactivity)

### 2.2 VideoMetadata Display Component

**File**: `web/src/components/attachment/previews/VideoMetadata.tsx` (NEW FILE)

**What this does**: Displays technical video information in a card.

**Props**:

```typescript
interface VideoMetadataProps {
  metadata?: VideoMetadata;
  filename: string;
  fileSize?: number;
}
```

**Display information**:

- Duration: formatted as "HH:MM:SS"
- Resolution: "WIDTHxHEIGHT px"
- Frame Rate: "XX.XX fps"
- Codec: "h264"
- Bitrate: "XXXXX kbps"
- File Size: "XXX MB"

**Use utility functions** (defined in Phase 2.3):

- `formatDuration(ms: number): string` → "1:23:45"
- `formatBitrate(bps: number): string` → "5.2 Mbps"
- `formatFileSize(bytes: number): string` → "125 MB"

### 2.3 Utility Functions

**File**: `web/src/lib/utils.ts` (MODIFY EXISTING)

**Add these functions**:

```typescript
// Format milliseconds to HH:MM:SS or MM:SS
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// Format bits per second to human-readable format
export function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} kbps`;
  return `${bps} bps`;
}

// Format bytes to human-readable format
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
```

### 2.4 Browser Compatibility Check

**File**: `web/src/components/attachment/previews/VideoPreview.tsx` (add to component)

**What to do**: Before rendering video player, check if browser can play this format.

**Implementation**:

```typescript
const canPlayType = useCallback((mimeType: string): boolean => {
  const video = document.createElement("video");
  return video.canPlayType(mimeType) !== "";
}, []);

useEffect(() => {
  const supported = canPlayType(videoMimeType);
  setCanPlay(supported);
}, [videoMimeType, canPlayType]);

if (!canPlay) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <AlertCircle className="w-8 h-8 text-amber-500" />
      <p>Browser cannot play {videoMimeType}</p>
      <Button onClick={() => window.open(src, "_blank")}>
        Open in New Tab
      </Button>
      <Button variant="secondary" onClick={downloadFile}>
        Download
      </Button>
    </div>
  );
}
```

### 2.5 Update InlineAttachmentPreview Modal

**File**: `web/src/components/attachment/InlineAttachmentPreview.tsx` (MODIFY EXISTING)

**What to do**:

- Pass `metadata` prop from attachment to `VideoPreview` component
- Pass `fileSize` to `VideoMetadata` component
- Render `VideoMetadata` below or beside video player

---

## Phase 3: MIME Type Detection & Format Support (1-2 days)

### 3.1 Extend MIME Type Resolver

**File**: `web/src/components/attachment/utils/mimeTypeResolver.ts` (MODIFY EXISTING)

**What to do**: Add comprehensive video format detection.

**Add to file**:

```typescript
export const VIDEO_MIME_TYPES: Record<
  string,
  { ext: string; codec: string; browser: string }
> = {
  "video/mp4": { ext: ".mp4", codec: "H.264/AVC", browser: "all" },
  "video/mpeg": { ext: ".mpeg", codec: "MPEG-2", browser: "limited" },
  "video/webm": { ext: ".webm", codec: "VP8/VP9", browser: "chrome" },
  "video/ogg": { ext: ".ogv", codec: "Theora", browser: "firefox" },
  "video/quicktime": { ext: ".mov", codec: "H.264/ProRes", browser: "safari" },
  "video/x-matroska": { ext: ".mkv", codec: "Various", browser: "some" },
  "video/x-msvideo": { ext: ".avi", codec: "MPEG-4", browser: "limited" },
  "video/3gpp": { ext: ".3gp", codec: "H.264", browser: "limited" },
  "video/mp2t": { ext: ".ts", codec: "H.264/H.265", browser: "some" },
  "application/x-mpegURL": { ext: ".m3u8", codec: "HLS", browser: "all" },
};

export function isVideoMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("video/") || VIDEO_MIME_TYPES[mimeType] !== undefined
  );
}

export function getVideoFormatInfo(mimeType: string) {
  return VIDEO_MIME_TYPES[mimeType] || null;
}
```

### 3.2 Update Preview Component Type Routing

**File**: `web/src/components/attachment/InlineAttachmentPreview.tsx` (MODIFY)

**What to do**: Ensure `VideoPreview` is shown for all video MIME types.

**Find the logic that routes** to different preview components (likely a switch/if statement) and update to use `isVideoMimeType()`:

```typescript
if (isVideoMimeType(attachment.mediaType)) {
  return <VideoPreview src={attachmentUrl} filename={attachment.filename} />;
}
```

---

## Phase 4: Markdown Video Integration (1-2 days)

### Prerequisite: Understand Markdown System

1. Read `plugin/markdown/README.md` to understand architecture
2. Check `plugin/markdown/extensions/` to see how extensions work
3. Look at how markdown is rendered in `web/src/components/markdown/`

### 4.1 Backend Markdown Extension

**File**: `plugin/markdown/extensions/video.go` (NEW FILE)

**What this does**: Extends markdown parser to recognize video files and render them as inline players.

**Implementation**:

- Create a custom block parser for video syntax
- Support both image syntax `![alt](video.mp4)` and explicit directive `::video{src="..."}...`::`
- Detect video MIME types and handle appropriately

**Key points**:

- Check if attachment URI has video MIME type
- If yes: render as video block node instead of link
- If no: use default link handling
- Use goldmark's AST to create video nodes

### 4.2 Frontend Markdown Video Renderer

**File**: `web/src/components/markdown/renderers/VideoRenderer.tsx` (NEW FILE)

**What this does**: Renders video nodes from markdown AST.

**Props**:

```typescript
interface VideoNode {
  type: "video";
  src: string;
  alt?: string;
  width?: string;
  height?: string;
  controls?: boolean;
}

interface VideoRendererProps {
  node: VideoNode;
}
```

**Implementation**:

- Render as `<video>` element with basic controls
- Clicking opens full `InlineAttachmentPreview` modal
- Shows thumbnail + play icon overlay

---

## Phase 5: Streaming Support (OPTIONAL - Skip Unless Requested)

### 5.1 HLS/DASH Transcoding (Backend)

**File**: `plugin/httpgetter/streaming.go` (NEW FILE)

**Only implement if users report:**

- "Can't seek in large videos"
- "Videos >100MB are slow to load"

**Implementation**: Use ffmpeg to create HLS playlist and segments.

### 5.2 HLS.js Frontend Player (Frontend)

**Only implement after 5.1 is done.**

---

## Dependency Installation

### Backend (None Required)

- ✅ ffprobe and ffmpeg must be installed on system (already assumed)
- ✅ No new Go packages needed for Phase 1-4

### Frontend (Phase 1-4)

- ✅ No new npm packages required for Phase 1-4
- ⏳ Phase 5 only: `pnpm add hls.js video.js`

---

## Implementation Checklist

### Phase 1 Backend

- [ ] Modify `proto/api/v1/attachment.proto` with VideoMetadata message
- [ ] Run `buf generate` in proto directory
- [ ] Update `store/attachment.go` with VideoMetadata struct
- [ ] Create `plugin/httpgetter/video_metadata.go` with extraction functions
- [ ] Modify all driver implementations in `store/db/{sqlite,mysql,postgres}/attachment.go`
- [ ] Create `server/router/fileserver/streaming.go` with range request handler
- [ ] Integrate streaming.go into existing file server handler
- [ ] Test: Upload MP4 video, verify metadata is extracted
- [ ] Test: Verify HTTP 206 responses on Range requests

### Phase 2 Frontend

- [ ] Enhance `web/src/components/attachment/previews/VideoPreview.tsx`
- [ ] Create `web/src/components/attachment/previews/VideoMetadata.tsx`
- [ ] Add formatting functions to `web/src/lib/utils.ts`
- [ ] Test: Video plays with all controls
- [ ] Test: Keyboard shortcuts work
- [ ] Test: Fullscreen and PiP work
- [ ] Test: Mobile layout responsive

### Phase 3 Format Support

- [ ] Modify `web/src/components/attachment/utils/mimeTypeResolver.ts`
- [ ] Update InlineAttachmentPreview to use new type detection
- [ ] Test: Unsupported format shows fallback UI
- [ ] Test: Supported format plays

### Phase 4 Markdown

- [ ] Create `plugin/markdown/extensions/video.go`
- [ ] Create `web/src/components/markdown/renderers/VideoRenderer.tsx`
- [ ] Test: `![video](file.mp4)` renders as player
- [ ] Test: Clicking opens full preview

### Phase 5 (Optional)

- [ ] Create `plugin/httpgetter/streaming.go`
- [ ] Add hls.js to frontend
- [ ] Create HLS player component
- [ ] Test: Large videos stream with adaptive bitrate

---

## Testing Instructions

### Manual Testing for Phase 1-2

1. Start backend: `go run ./cmd/memos --mode dev --port 8081`
2. Start frontend: `cd web && pnpm dev`
3. Upload MP4 file in UI
4. Open attachment preview
5. Verify:
   - Video plays
   - All controls work
   - Metadata displays (if extraction succeeded)
   - Seeking works smoothly
   - Keyboard shortcuts functional

### Manual Testing for Phase 3-4

1. Create memo with `![video](path/to/video.mp4)`
2. Verify video renders inline
3. Verify clicking opens full preview

### Network Testing

1. Open DevTools → Network
2. Upload large video (50+ MB)
3. Seek to different parts
4. Verify Range requests (206 responses, not full file download)

---

## Common Issues & Solutions

### Issue: ffprobe not found

- **Solution**: Gracefully return nil metadata instead of failing. Checked in Phase 1.3 implementation.

### Issue: Video doesn't seek

- **Solution**: Ensure HTTP 206 responses are sent for Range requests. Check streaming.go implementation.

### Issue: TypeScript compilation errors

- **Solution**: Run `cd proto && buf generate` after proto changes. Regenerates TypeScript types.

### Issue: Video controls not responding

- **Solution**: Ensure `useCallback` is used for event handlers, not inline functions. Check for missing cleanup in useEffect.

---

## Summary

- **Phase 1**: 2-3 days - Proto changes, metadata extraction, range request support
- **Phase 2**: 3-4 days - Enhanced video player with controls
- **Phase 3**: 1-2 days - MIME type detection and fallback UI
- **Phase 4**: 1-2 days - Markdown integration
- **Phase 5**: 3-5 days (optional) - HLS streaming for large files

**Total estimate**: 7-11 days (without Phase 5)

---

## Quick Reference: File Locations

**Proto Changes**:

- `proto/api/v1/attachment.proto`

**Backend Files to Create**:

- `plugin/httpgetter/video_metadata.go`
- `server/router/fileserver/streaming.go`

**Backend Files to Modify**:

- `store/attachment.go`
- `store/db/sqlite/attachment.go`
- `store/db/mysql/attachment.go`
- `store/db/postgres/attachment.go`
- `server/router/fileserver/handler.go`

**Frontend Files to Create**:

- `web/src/components/attachment/previews/VideoMetadata.tsx`
- `web/src/components/markdown/renderers/VideoRenderer.tsx`
- `plugin/markdown/extensions/video.go`

**Frontend Files to Modify**:

- `web/src/components/attachment/previews/VideoPreview.tsx`
- `web/src/components/attachment/utils/mimeTypeResolver.ts`
- `web/src/lib/utils.ts`
- `web/src/components/attachment/InlineAttachmentPreview.tsx`

---

# Feature: Inline Video Link Preview

## Overview

Implement a feature that allows users to embed video links (YouTube, Bilibili, Vimeo) directly into memos and preview them inline. When a user adds a video link, it is treated as a special attachment type that renders an embedded video player within the memo detail page.

## Status: ✅ IMPLEMENTED (January 2026)

### Implementation Summary

The inline video link preview feature has been fully implemented with the following capabilities:

- **Video Link as Attachment**: Video URLs are stored as "virtual attachments" with external link storage
- **Multi-platform Support**: YouTube, Bilibili, and Vimeo video embeds
- **Inline Preview**: Videos are previewed directly within the memo detail page using iframe embeds
- **Add Video Link Dialog**: Easy-to-use dialog for inputting and validating video URLs
- **Auto-detection**: Automatic detection of video provider with validation feedback

---

## Supported Video Platforms

| Platform     | URL Patterns                                                                     | Embed Format                                                       |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **YouTube**  | `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/` | `https://www.youtube.com/embed/{id}`                               |
| **Bilibili** | `bilibili.com/video/BV...`, `bilibili.com/video/av...`, `b23.tv/`                | `https://player.bilibili.com/player.html?isOutside=true&bvid={id}` |
| **Vimeo**    | `vimeo.com/{id}`, `player.vimeo.com/video/{id}`                                  | `https://player.vimeo.com/video/{id}`                              |

---

## Architecture

```
web/src/components/
├── attachment/
│   ├── utils/
│   │   ├── mimeTypeResolver.ts       # Added "video_link" preview type
│   │   └── videoLinkResolver.ts      # NEW: Video URL parsing & embed generation
│   ├── previews/
│   │   └── VideoLinkPreview.tsx      # NEW: iframe-based video embed viewer
│   └── AttachmentPreviewContent.tsx  # Updated to handle video_link type
├── MemoEditor/
│   ├── components/
│   │   ├── AddVideoLinkDialog.tsx    # NEW: Dialog for adding video URLs
│   │   └── index.ts                  # Updated exports
│   ├── Toolbar/
│   │   └── InsertMenu.tsx            # Updated with "Add Video Link" option
│   └── types/
│       └── components.ts             # Updated InsertMenuProps
└── AttachmentIcon.tsx                # Updated with video link icon

server/router/api/v1/
└── attachment_service.go             # Updated to handle external links
```

---

## Implementation Details

### Files Created

| File                                                              | Purpose                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `web/src/components/attachment/utils/videoLinkResolver.ts`        | Parses video URLs, extracts video IDs, generates embed URLs |
| `web/src/components/attachment/previews/VideoLinkPreview.tsx`     | Renders video embeds using iframe with loading states       |
| `web/src/components/MemoEditor/components/AddVideoLinkDialog.tsx` | Modal dialog for inputting and validating video URLs        |

### Files Modified

| File                                                         | Changes                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `web/src/components/attachment/utils/mimeTypeResolver.ts`    | Added `video_link` to `PreviewType`, imports `VIDEO_LINK_MIME_TYPE` |
| `web/src/components/attachment/AttachmentPreviewContent.tsx` | Added `video_link` case to render `VideoLinkPreview`                |
| `web/src/components/MemoEditor/components/index.ts`          | Exported `AddVideoLinkDialog`                                       |
| `web/src/components/MemoEditor/types/components.ts`          | Added `onAddVideoLink` callback to `InsertMenuProps`                |
| `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`       | Added "Add Video Link" menu item and dialog integration             |
| `web/src/components/MemoEditor/components/EditorToolbar.tsx` | Handles video link creation via attachment API                      |
| `web/src/components/AttachmentIcon.tsx`                      | Shows `PlayCircleIcon` for video link attachments                   |
| `server/router/api/v1/attachment_service.go`                 | Backend support for external link attachments                       |

---

## Component API

### videoLinkResolver.ts

```typescript
// Types
type VideoProvider = "youtube" | "bilibili" | "vimeo" | "unknown";

interface VideoLinkInfo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl?: string; // Available for YouTube
  originalUrl: string;
}

// Functions
function parseVideoUrl(url: string): VideoLinkInfo | null;
function isVideoUrl(url: string): boolean;
function getProviderDisplayName(provider: VideoProvider): string;
function getProviderColor(provider: VideoProvider): string;
function generateVideoLinkFilename(info: VideoLinkInfo): string;

// Constants
const VIDEO_LINK_MIME_TYPE = "application/x-video-link";
```

### VideoLinkPreview

```tsx
interface VideoLinkPreviewProps {
  src: string; // The embed URL (iframe src)
  originalUrl?: string; // Original video page URL for fallback
  isLoading?: boolean; // Loading state
}
```

Features:

- Loading overlay with provider-specific messaging
- Timeout-based loading state (cross-origin iframes don't fire onLoad reliably)
- Error fallback with retry and "Open in new tab" options
- Provider badge with external link

### AddVideoLinkDialog

```tsx
interface AddVideoLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (info: VideoLinkInfo) => void;
}
```

Features:

- URL input with auto-validation
- Real-time provider detection feedback
- YouTube thumbnail preview
- Supported platforms hint
- Enter key to confirm

---

## User Flow

### Adding a Video Link

1. **Open Editor**: Click "+" button in memo editor toolbar
2. **Select Option**: Choose "Add Video Link" from dropdown menu
3. **Paste URL**: Enter video URL in the dialog (e.g., `https://www.bilibili.com/video/BV1oDrZBZEhU`)
4. **Validation**: System auto-detects provider and shows validation status
5. **Confirm**: Click "Add Video" button
6. **Attachment Created**: Video link appears in attachment list with play icon

### Viewing a Video Link

1. **Open Memo**: Navigate to memo detail page
2. **Click Attachment**: Click the video link attachment (shows PlayCircle icon)
3. **Inline Preview**: Video embed appears below attachment list
4. **Playback**: Use native video player controls
5. **External Link**: Click provider badge to open original video page

---

## Backend Implementation

### Storage Model

Video links are stored as attachments with:

- **StorageType**: `EXTERNAL`
- **Reference**: Original video URL (e.g., `https://www.bilibili.com/video/BV1oDrZBZEhU`)
- **Type**: `application/x-video-link`
- **Filename**: Generated display name (e.g., "Bilibili Video (BV1oDrZBZEhU)")

### CreateAttachment Changes

```go
// Check if this is an external link attachment (e.g., video link)
if request.Attachment.ExternalLink != "" {
    // For external links, store the URL as reference with EXTERNAL storage type
    create.Reference = request.Attachment.ExternalLink
    create.StorageType = storepb.AttachmentStorageType_EXTERNAL
    create.Size = 0
    // Skip blob storage for external links
} else {
    // Handle regular file uploads
    // ...existing blob storage logic...
}
```

### API Flow

```
Frontend                          Backend
   |                                 |
   |  CreateAttachment               |
   |  { externalLink: "https://..." }|
   |  ─────────────────────────────> |
   |                                 |  Store with StorageType=EXTERNAL
   |                                 |  Reference=externalLink
   |  <───────────────────────────── |
   |  Attachment { externalLink }    |
   |                                 |
```

---

## Embed URL Generation

### YouTube

```typescript
// Input patterns
/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/// Output
`https://www.youtube.com/embed/${videoId}`// Thumbnail
`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
```

### Bilibili

```typescript
// Input patterns
/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i
/bilibili\.com\/video\/av(\d+)/i
/b23\.tv\/([a-zA-Z0-9]+)/

// Output (BV format)
`https://player.bilibili.com/player.html?isOutside=true&bvid=${videoId}&autoplay=0&p=1`

// Output (AV format)
`https://player.bilibili.com/player.html?isOutside=true&aid=${videoId}&autoplay=0&p=1`
```

**Important**: The `isOutside=true` parameter is required for Bilibili embeds to work on external sites.

### Vimeo

```typescript
// Input patterns
/vimeo\.com\/(\d+)/
/player\.vimeo\.com\/video\/(\d+)/

// Output
`https://player.vimeo.com/video/${videoId}`
```

---

## iframe Configuration

The video embed iframe uses specific attributes for compatibility:

```tsx
<iframe
  src={embedUrl}
  className="w-full h-full border-0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
  allowFullScreen
  scrolling="no"
  referrerPolicy="no-referrer-when-downgrade"
  loading="eager"
  title={`${providerName} video player`}
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
/>
```

### Key Attributes

| Attribute         | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `allow`           | Permissions for embedded content (fullscreen, autoplay, etc.) |
| `allowFullScreen` | Enable fullscreen mode                                        |
| `scrolling="no"`  | Prevent scrollbars in iframe                                  |
| `sandbox`         | Security restrictions while allowing necessary features       |
| `loading="eager"` | Load immediately (not lazy)                                   |

---

## Loading State Handling

Cross-origin iframes don't reliably fire `onLoad` events. The implementation uses a timeout-based approach:

```typescript
useEffect(() => {
  if (!src) return;

  // Reset states when src changes
  setShowLoading(true);
  setError(false);

  // Hide loading overlay after 1.5 seconds
  const timer = setTimeout(() => {
    setShowLoading(false);
  }, 1500);

  return () => clearTimeout(timer);
}, [src]);
```

---

## UI Components

### Insert Menu

```
┌─────────────────────────┐
│ ⊕ (Plus Button)         │
├─────────────────────────┤
│ 📁 Upload               │
│ 🎬 Add Video Link       │  ← NEW
│ 🔗 Link Memo            │
│ 📍 Select Location      │
│ ⋯ More                  │
│   └─ Focus Mode         │
│ Tip: Type / for commands│
└─────────────────────────┘
```

### Add Video Link Dialog

```
┌─────────────────────────────────────────┐
│ 🎬 Add Video Link                    ✕  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Paste video URL (YouTube, Bilibili, │ │
│ │ Vimeo...)                           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ✓ Detected: Bilibili                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [YouTube Thumbnail Preview]         │ │
│ │        ▶                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Supported: YouTube, Bilibili, Vimeo     │
│                                         │
│              [Cancel] [Add Video]       │
└─────────────────────────────────────────┘
```

### Video Link Attachment Icon

Video links display with a distinctive `PlayCircleIcon` in red to differentiate from regular video files:

```tsx
if (attachment.type === VIDEO_LINK_MIME_TYPE) {
  return <PlayCircleIcon className="w-full h-auto text-red-500" />;
}
```

### Inline Video Preview

```
┌─────────────────────────────────────────────────────────┐
│ ◀ 1/3 ▶  Bilibili Video (BV1oDrZBZEhU)    ⬇️  ✕        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │                  [Video Player]                     │ │
│ │                                                     │ │
│ │                                            Bilibili │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Testing

### Manual Testing Checklist

- [x] "Add Video Link" appears in insert menu
- [x] Dialog opens when clicking "Add Video Link"
- [x] YouTube URL is detected and validated
- [x] Bilibili URL is detected and validated
- [x] Vimeo URL is detected and validated
- [x] Invalid URLs show error message
- [x] YouTube thumbnail preview appears
- [x] Video link attachment is created on confirm
- [x] Video link shows PlayCircle icon in attachment list
- [x] Clicking video link opens inline preview
- [x] Bilibili video plays correctly with `isOutside=true`
- [x] YouTube video plays correctly
- [x] Provider badge links to original video
- [x] Loading state shows and hides appropriately
- [x] Error fallback with retry works

### Test URLs

```
# YouTube
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
https://www.youtube.com/shorts/abc123xyz00

# Bilibili
https://www.bilibili.com/video/BV1oDrZBZEhU
https://www.bilibili.com/video/BV1oDrZBZEhU/?share_source=copy_web
https://b23.tv/abc123

# Vimeo
https://vimeo.com/123456789
https://player.vimeo.com/video/123456789
```

---

## Known Limitations

1. **Bilibili Thumbnails**: Bilibili doesn't provide a simple public thumbnail URL format, so no thumbnail preview in the dialog
2. **Cross-origin Restrictions**: Some video providers may block embedding on certain domains
3. **Mobile Autoplay**: Mobile browsers may restrict video autoplay
4. **Network Dependency**: Video playback requires internet connection to provider servers

---

## Future Enhancements

1. **More Providers**: Add support for TikTok, Twitter/X videos, Twitch clips
2. **Video Metadata**: Fetch and display video title, duration, view count
3. **Offline Indicator**: Show message when video cannot be loaded
4. **Timestamp Links**: Support YouTube timestamps (e.g., `?t=120`)
5. **Playlist Support**: Handle YouTube/Bilibili playlist URLs
6. **Auto-paste Detection**: Auto-detect video URLs when pasting into editor
7. **Video Thumbnails in List**: Show video thumbnails in memo list view
8. **Keyboard Shortcuts**: Add shortcuts for video playback control

---

## Related Documentation

- [Inline Attachment Preview](./feat_multimodal.md) - Base attachment preview system
- [AGENTS.md](./AGENTS.md) - Codebase guide for development

---

## Changelog

### January 2026

- Initial implementation of video link feature
- Support for YouTube, Bilibili, Vimeo
- Backend support for external link attachments
- Frontend components for adding and viewing video links

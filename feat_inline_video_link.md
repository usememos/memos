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

| Platform | URL Patterns | Embed Format |
|----------|--------------|--------------|
| **YouTube** | `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/` | `https://www.youtube.com/embed/{id}` |
| **Bilibili** | `bilibili.com/video/BV...`, `bilibili.com/video/av...`, `b23.tv/` | `https://player.bilibili.com/player.html?isOutside=true&bvid={id}` |
| **Vimeo** | `vimeo.com/{id}`, `player.vimeo.com/video/{id}` | `https://player.vimeo.com/video/{id}` |

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

| File | Purpose |
|------|---------|
| `web/src/components/attachment/utils/videoLinkResolver.ts` | Parses video URLs, extracts video IDs, generates embed URLs |
| `web/src/components/attachment/previews/VideoLinkPreview.tsx` | Renders video embeds using iframe with loading states |
| `web/src/components/MemoEditor/components/AddVideoLinkDialog.tsx` | Modal dialog for inputting and validating video URLs |

### Files Modified

| File | Changes |
|------|---------|
| `web/src/components/attachment/utils/mimeTypeResolver.ts` | Added `video_link` to `PreviewType`, imports `VIDEO_LINK_MIME_TYPE` |
| `web/src/components/attachment/AttachmentPreviewContent.tsx` | Added `video_link` case to render `VideoLinkPreview` |
| `web/src/components/MemoEditor/components/index.ts` | Exported `AddVideoLinkDialog` |
| `web/src/components/MemoEditor/types/components.ts` | Added `onAddVideoLink` callback to `InsertMenuProps` |
| `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx` | Added "Add Video Link" menu item and dialog integration |
| `web/src/components/MemoEditor/components/EditorToolbar.tsx` | Handles video link creation via attachment API |
| `web/src/components/AttachmentIcon.tsx` | Shows `PlayCircleIcon` for video link attachments |
| `server/router/api/v1/attachment_service.go` | Backend support for external link attachments |

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
  thumbnailUrl?: string;  // Available for YouTube
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
  src: string;          // The embed URL (iframe src)
  originalUrl?: string; // Original video page URL for fallback
  isLoading?: boolean;  // Loading state
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
/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/

// Output
`https://www.youtube.com/embed/${videoId}`

// Thumbnail
`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
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

| Attribute | Purpose |
|-----------|---------|
| `allow` | Permissions for embedded content (fullscreen, autoplay, etc.) |
| `allowFullScreen` | Enable fullscreen mode |
| `scrolling="no"` | Prevent scrollbars in iframe |
| `sandbox` | Security restrictions while allowing necessary features |
| `loading="eager"` | Load immediately (not lazy) |

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

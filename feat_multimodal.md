# Feature: Inline Attachment Preview

## Overview

Implement a feature that allows users to directly view attachments inside the memo detail page. When a user clicks an attachment, a preview panel opens **inline within the memo container** to display the attachment content based on its MIME type.

## Status: ✅ IMPLEMENTED (January 2026)

### Implementation Summary

The inline attachment preview feature has been fully implemented with the following capabilities:

- **Inline Preview**: Attachments are previewed directly within the memo detail page container (no modal overlay)
- **Multi-format Support**: Images, PDFs, videos, audio, text/code files
- **PDF Viewer**: Full PDF rendering using `react-pdf` with page navigation and zoom controls
- **Navigation**: Previous/next buttons for navigating between multiple attachments
- **Download**: Quick download button in the preview header

---

## Implementation Details

### Architecture

```
web/src/components/
├── attachment/
│   ├── index.ts                      # Exports
│   ├── AttachmentPreviewModal.tsx    # Global modal (for Attachments page)
│   ├── AttachmentPreviewContent.tsx  # Preview content resolver
│   ├── InlineAttachmentPreview.tsx   # Inline preview container (for memo detail)
│   ├── hooks/
│   │   └── useAttachmentPreview.tsx  # React Context for preview state
│   ├── previews/
│   │   ├── ImagePreview.tsx          # Image viewer with zoom/pan/rotate
│   │   ├── PDFPreview.tsx            # PDF.js viewer with page navigation
│   │   ├── VideoPreview.tsx          # HTML5 video player
│   │   ├── AudioPreview.tsx          # Audio player with visual placeholder
│   │   ├── TextPreview.tsx           # Code/text viewer with copy
│   │   └── FallbackPreview.tsx       # Download prompt for unsupported types
│   └── utils/
│       └── mimeTypeResolver.ts       # MIME type detection & language mapping
```

### Files Created

| File                                                           | Purpose                                    |
| -------------------------------------------------------------- | ------------------------------------------ |
| `web/src/components/attachment/index.ts`                       | Module exports                             |
| `web/src/components/attachment/hooks/useAttachmentPreview.tsx` | React Context for preview state management |
| `web/src/components/attachment/utils/mimeTypeResolver.ts`      | MIME type to preview type resolver         |
| `web/src/components/attachment/AttachmentPreviewModal.tsx`     | Modal overlay (used on Attachments page)   |
| `web/src/components/attachment/AttachmentPreviewContent.tsx`   | Dynamic preview component resolver         |
| `web/src/components/attachment/InlineAttachmentPreview.tsx`    | Inline preview container for memo detail   |
| `web/src/components/attachment/previews/ImagePreview.tsx`      | Image viewer with zoom/pan/rotate          |
| `web/src/components/attachment/previews/PDFPreview.tsx`        | PDF viewer using react-pdf                 |
| `web/src/components/attachment/previews/VideoPreview.tsx`      | HTML5 video player                         |
| `web/src/components/attachment/previews/AudioPreview.tsx`      | Audio player                               |
| `web/src/components/attachment/previews/TextPreview.tsx`       | Text/code viewer with syntax detection     |
| `web/src/components/attachment/previews/FallbackPreview.tsx`   | Fallback for unsupported types             |

### Files Modified

| File                                                                 | Changes                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `web/src/App.tsx`                                                    | Added `AttachmentPreviewProvider` and `AttachmentPreviewModal`  |
| `web/src/lib/utils.ts`                                               | Added `formatFileSize()` utility function                       |
| `web/src/components/AttachmentIcon.tsx`                              | Updated to use preview system                                   |
| `web/src/components/MemoAttachment.tsx`                              | Updated to use preview system                                   |
| `web/src/components/MemoView/components/metadata/AttachmentList.tsx` | Integrated inline preview - shows preview below attachment list |
| `web/src/pages/Attachments.tsx`                                      | Uses modal preview for attachment gallery                       |

### Dependencies Added

| Package     | Version | Purpose                                     |
| ----------- | ------- | ------------------------------------------- |
| `react-pdf` | 10.3.0  | PDF rendering with page navigation and zoom |

---

## Features Implemented

### 1. Inline Preview (Memo Detail Page)

When viewing a memo at `/memos/{id}`, clicking an attachment shows the preview **directly below the attachment list** within the memo container:

- Click attachment → Preview appears inline
- Click again → Preview closes (toggle behavior)
- Selected attachment is highlighted with a ring
- Navigation controls for multiple attachments
- Fixed height container (400px mobile, 500px desktop)

### 2. PDF Viewer

Full-featured PDF viewer using `react-pdf`:

- **Page Navigation**: Previous/Next buttons with page counter (e.g., "1 / 10")
- **Zoom Controls**: Zoom in/out (50% - 300%) with percentage display
- **Download Button**: Quick download access
- **Loading States**: Spinner while PDF loads
- **Error Fallback**: Options to open in new tab or download if rendering fails

### 3. Image Viewer

- **Zoom**: Scroll wheel or buttons (25% - 500%)
- **Pan**: Drag to move when zoomed in
- **Rotate**: 90° rotation button
- **Reset**: Return to original view

### 4. Video/Audio Players

- Native HTML5 players with controls
- Visual placeholder for audio files

### 5. Text/Code Viewer

- Language detection from file extension
- Copy to clipboard button
- Monospace font rendering

### 6. Fallback Handler

- File icon and metadata display
- Download button for unsupported types

---

## Usage

### In Memo Detail Page

Attachments are displayed in the `AttachmentList` component. Click any attachment to see its preview inline:

```tsx
// AttachmentList manages its own selection state
const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(
  null
);

// Preview appears below the attachment grid
{
  selectedAttachment && (
    <InlineAttachmentPreview
      attachment={selectedAttachment}
      attachments={attachments}
      onClose={handleClose}
      onNavigate={handleNavigate}
    />
  );
}
```

### In Attachments Gallery Page

Uses the modal overlay approach for full-screen preview:

```tsx
const { openPreview } = useAttachmentPreview();

// Opens modal overlay
openPreview(attachment, allAttachments);
```

---

## Component API

### InlineAttachmentPreview

```tsx
interface InlineAttachmentPreviewProps {
  attachment: Attachment; // Current attachment to preview
  attachments: Attachment[]; // All attachments for navigation
  onClose: () => void; // Close callback
  onNavigate: (attachment: Attachment) => void; // Navigate callback
}
```

### PDFPreview

```tsx
interface PDFPreviewProps {
  src: string; // PDF URL
  filename: string; // Filename for download
  isLoading?: boolean;
}
```

Features:

- Page navigation (prev/next)
- Zoom controls (50% - 300%)
- Download button
- Error fallback with alternative options

---

## Testing

### Manual Testing Checklist

- [x] Click attachment opens inline preview
- [x] Click again closes preview (toggle)
- [x] PDF renders with page navigation
- [x] PDF zoom in/out works
- [x] Image zoom/pan/rotate works
- [x] Video plays with controls
- [x] Audio plays with controls
- [x] Text files display with copy button
- [x] Unsupported files show download option
- [x] Navigation between attachments works
- [x] Download button works

---

## Future Enhancements

1. **Keyboard Navigation**: Arrow keys for prev/next in inline view
2. **Lazy Loading**: Load previews only when selected
3. **Preloading**: Preload adjacent attachments
4. **Full-screen Mode**: Expand inline preview to full screen
5. **Syntax Highlighting**: Integrate highlight.js for code files
6. **PDF Text Selection**: Enable text selection in PDF viewer
7. **PDF Search**: Add text search within PDF documents

---

## Original Design Document

The sections below contain the original design document for reference.

---

## Goals

1. **Inline Viewing**: Users can preview attachments without leaving the memo detail page
2. **Multi-format Support**: Handle images, PDFs, videos, audio, text/code files gracefully
3. **Smooth UX**: Fast loading, keyboard navigation, responsive design
4. **Fallback Handling**: Graceful degradation for unsupported file types

## User Stories

- As a user, I want to click on an attachment in a memo and see its content inline
- As a user, I want to navigate between multiple attachments using buttons
- As a user, I want to download the attachment from the preview
- As a user, I want to close the preview by clicking a close button or clicking the attachment again
- As a user, I want to see a loading indicator while the attachment is being fetched
- As a user, I want to zoom/pan images and navigate PDF pages

---

## Technical Design

### Architecture Overview

```
web/src/components/
├── attachment/
│   ├── AttachmentPreviewModal.tsx    # Main modal container
│   ├── AttachmentPreviewContent.tsx  # Preview content resolver
│   ├── previews/
│   │   ├── ImagePreview.tsx          # Image viewer with zoom/pan
│   │   ├── PDFPreview.tsx            # PDF.js or iframe viewer
│   │   ├── VideoPreview.tsx          # HTML5 video player
│   │   ├── AudioPreview.tsx          # Audio player with waveform
│   │   ├── TextPreview.tsx           # Syntax-highlighted code/text
│   │   └── FallbackPreview.tsx       # Download prompt for unsupported types
│   └── hooks/
│       └── useAttachmentPreview.ts   # Preview state management hook
```

### Component Hierarchy

```
<AttachmentPreviewModal>
  ├── <ModalOverlay />                 # Backdrop with click-to-close
  ├── <ModalHeader>
  │   ├── <FileName />                 # Display filename
  │   ├── <FileInfo />                 # Size, type
  │   ├── <DownloadButton />           # Download action
  │   └── <CloseButton />              # Close modal
  ├── <ModalBody>
  │   ├── <NavigationArrow left />     # Previous attachment
  │   ├── <AttachmentPreviewContent /> # Dynamic preview component
  │   └── <NavigationArrow right />    # Next attachment
  └── <ModalFooter>
      └── <AttachmentThumbnails />     # Thumbnail strip (optional)
```

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### Task 1.1: Create Attachment Blob Hook

**File:** `web/src/hooks/useAttachmentQueries.ts`

Add a new hook to fetch attachment blob data for preview:

```typescript
// Add to existing attachmentKeys
export const attachmentKeys = {
  // ...existing keys...
  blobs: () => [...attachmentKeys.all, "blob"] as const,
  blob: (name: string) => [...attachmentKeys.blobs(), name] as const,
};

// New hook to fetch attachment blob URL
export function useAttachmentBlob(
  name: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: attachmentKeys.blob(name),
    queryFn: async () => {
      // Extract UID from attachment name (format: "attachments/{uid}")
      const uid = name.replace("attachments/", "");
      const response = await fetch(`/file/${uid}/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch attachment: ${response.statusText}`);
      }
      const blob = await response.blob();
      return {
        url: URL.createObjectURL(blob),
        blob,
      };
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes - blobs don't change
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
```

**Considerations:**

- The existing `/file/{name}/{filename}` endpoint in `server/router/fileserver/` serves attachment blobs
- Need to handle blob URL cleanup with `URL.revokeObjectURL()` on unmount
- Consider caching strategy for large files

#### Task 1.2: Create Preview State Context

**File:** `web/src/components/attachment/hooks/useAttachmentPreview.ts`

```typescript
import { create } from "zustand";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

interface AttachmentPreviewState {
  isOpen: boolean;
  currentAttachment: Attachment | null;
  attachments: Attachment[];
  currentIndex: number;

  // Actions
  openPreview: (attachment: Attachment, attachments?: Attachment[]) => void;
  closePreview: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
}

export const useAttachmentPreviewStore = create<AttachmentPreviewState>(
  (set, get) => ({
    isOpen: false,
    currentAttachment: null,
    attachments: [],
    currentIndex: 0,

    openPreview: (attachment, attachments = []) => {
      const index = attachments.findIndex((a) => a.name === attachment.name);
      set({
        isOpen: true,
        currentAttachment: attachment,
        attachments: attachments.length > 0 ? attachments : [attachment],
        currentIndex: index >= 0 ? index : 0,
      });
    },

    closePreview: () => set({ isOpen: false, currentAttachment: null }),

    goToNext: () => {
      const { attachments, currentIndex } = get();
      if (currentIndex < attachments.length - 1) {
        const nextIndex = currentIndex + 1;
        set({
          currentIndex: nextIndex,
          currentAttachment: attachments[nextIndex],
        });
      }
    },

    goToPrevious: () => {
      const { attachments, currentIndex } = get();
      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        set({
          currentIndex: prevIndex,
          currentAttachment: attachments[prevIndex],
        });
      }
    },

    goToIndex: (index) => {
      const { attachments } = get();
      if (index >= 0 && index < attachments.length) {
        set({
          currentIndex: index,
          currentAttachment: attachments[index],
        });
      }
    },
  })
);
```

---

### Phase 2: Preview Components

#### Task 2.1: MIME Type Resolver Utility

**File:** `web/src/components/attachment/utils/mimeTypeResolver.ts`

```typescript
export type PreviewType =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "text"
  | "code"
  | "fallback";

const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".sql",
  ".graphql",
  ".yaml",
  ".yml",
  ".toml",
  ".json",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".vue",
  ".svelte",
  ".md",
  ".mdx",
  ".rst",
  ".tex",
  ".dockerfile",
  ".makefile",
];

const CODE_MIME_TYPES = [
  "application/javascript",
  "application/typescript",
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/toml",
];

export function getPreviewType(
  mimeType: string,
  filename: string
): PreviewType {
  // Images
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  // PDF
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  // Video
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  // Audio
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  // Code files (by MIME type)
  if (CODE_MIME_TYPES.includes(mimeType)) {
    return "code";
  }

  // Code files (by extension)
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if (CODE_EXTENSIONS.includes(ext)) {
    return "code";
  }

  // Plain text
  if (mimeType.startsWith("text/")) {
    return "text";
  }

  // Fallback for unsupported types
  return "fallback";
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
  };
  return languageMap[ext] || "plaintext";
}
```

#### Task 2.2: Image Preview Component

**File:** `web/src/components/attachment/previews/ImagePreview.tsx`

```typescript
import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

interface ImagePreviewProps {
  src: string;
  alt: string;
  isLoading?: boolean;
}

export function ImagePreview({ src, alt, isLoading }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.25, Math.min(5, s + delta)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition((p) => ({
        x: p.x + e.movementX,
        y: p.y + e.movementY,
      }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 bg-black/50 rounded-lg p-2">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-white/20 rounded"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white self-center px-2">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-white/20 rounded"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={handleRotate}
          className="p-2 hover:bg-white/20 rounded"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </button>
        <button onClick={handleReset} className="p-2 hover:bg-white/20 rounded">
          <Maximize2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
```

#### Task 2.3: Video Preview Component

**File:** `web/src/components/attachment/previews/VideoPreview.tsx`

```typescript
import { useRef, useState } from "react";

interface VideoPreviewProps {
  src: string;
  type: string;
  isLoading?: boolean;
}

export function VideoPreview({ src, type, isLoading }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p>Failed to load video</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay={false}
        className="max-w-full max-h-full"
        onError={(e) => setError("Video format not supported")}
      >
        <source src={src} type={type} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
```

#### Task 2.4: Audio Preview Component

**File:** `web/src/components/attachment/previews/AudioPreview.tsx`

```typescript
import { Music } from "lucide-react";

interface AudioPreviewProps {
  src: string;
  filename: string;
  type: string;
  isLoading?: boolean;
}

export function AudioPreview({
  src,
  filename,
  type,
  isLoading,
}: AudioPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      {/* Album art placeholder */}
      <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-primary/40 rounded-2xl flex items-center justify-center shadow-lg">
        <Music className="w-24 h-24 text-primary/60" />
      </div>

      {/* Filename */}
      <p className="text-lg font-medium text-gray-700 dark:text-gray-300 text-center max-w-md truncate">
        {filename}
      </p>

      {/* Audio player */}
      <audio src={src} controls className="w-full max-w-md">
        <source src={src} type={type} />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
```

#### Task 2.5: PDF Preview Component

**File:** `web/src/components/attachment/previews/PDFPreview.tsx`

```typescript
import { useState } from "react";
import { ExternalLink } from "lucide-react";

interface PDFPreviewProps {
  src: string;
  filename: string;
  isLoading?: boolean;
}

export function PDFPreview({ src, filename, isLoading }: PDFPreviewProps) {
  const [iframeError, setIframeError] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Fallback if iframe fails (some browsers block PDF embedding)
  if (iframeError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-gray-600 dark:text-gray-400">
          PDF preview not available in this browser
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <ExternalLink className="w-4 h-4" />
          Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        title={filename}
        className="w-full h-full border-0"
        onError={() => setIframeError(true)}
      />
    </div>
  );
}
```

#### Task 2.6: Text/Code Preview Component

**File:** `web/src/components/attachment/previews/TextPreview.tsx`

```typescript
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { getLanguageFromFilename } from "../utils/mimeTypeResolver";

interface TextPreviewProps {
  src: string;
  filename: string;
  isLoading?: boolean;
}

export function TextPreview({ src, filename, isLoading }: TextPreviewProps) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const language = getLanguageFromFilename(filename);

  useEffect(() => {
    if (!src) return;

    fetch(src)
      .then((res) => res.text())
      .then(setContent)
      .catch((err) => setError(err.message));
  }, [src]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || (!content && !error)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Failed to load file: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Header with language and copy button */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b">
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words bg-gray-50 dark:bg-gray-900 min-h-full">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}
```

**Enhancement:** Consider integrating with existing syntax highlighting (if project uses one) or add `highlight.js`/`shiki` for better code rendering.

#### Task 2.7: Fallback Preview Component

**File:** `web/src/components/attachment/previews/FallbackPreview.tsx`

```typescript
import { FileIcon, Download } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface FallbackPreviewProps {
  filename: string;
  type: string;
  size: number;
  downloadUrl: string;
}

export function FallbackPreview({
  filename,
  type,
  size,
  downloadUrl,
}: FallbackPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      {/* File icon */}
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
        <FileIcon className="w-12 h-12 text-gray-400" />
      </div>

      {/* File info */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
          {filename}
        </p>
        <p className="text-sm text-gray-500">
          {type} • {formatFileSize(size)}
        </p>
      </div>

      {/* Message */}
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        Preview is not available for this file type. You can download it to view
        locally.
      </p>

      {/* Download button */}
      <a
        href={downloadUrl}
        download={filename}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Download className="w-5 h-5" />
        Download File
      </a>
    </div>
  );
}
```

---

### Phase 3: Modal Container

#### Task 3.1: Main Modal Component

**File:** `web/src/components/attachment/AttachmentPreviewModal.tsx`

```typescript
import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAttachmentPreviewStore } from "./hooks/useAttachmentPreview";
import { useAttachmentBlob } from "@/hooks/useAttachmentQueries";
import { AttachmentPreviewContent } from "./AttachmentPreviewContent";
import { formatFileSize } from "@/lib/utils";

export function AttachmentPreviewModal() {
  const {
    isOpen,
    currentAttachment,
    attachments,
    currentIndex,
    closePreview,
    goToNext,
    goToPrevious,
  } = useAttachmentPreviewStore();

  const hasNext = currentIndex < attachments.length - 1;
  const hasPrevious = currentIndex > 0;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          closePreview();
          break;
        case "ArrowRight":
          if (hasNext) goToNext();
          break;
        case "ArrowLeft":
          if (hasPrevious) goToPrevious();
          break;
      }
    },
    [isOpen, hasNext, hasPrevious, closePreview, goToNext, goToPrevious]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !currentAttachment) {
    return null;
  }

  const downloadUrl = `/file/${currentAttachment.name.replace(
    "attachments/",
    ""
  )}/${currentAttachment.filename}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={closePreview}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full h-full max-w-7xl max-h-[90vh] m-4 flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="font-medium text-gray-800 dark:text-gray-200 truncate">
              {currentAttachment.filename}
            </h3>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {currentAttachment.type} •{" "}
              {formatFileSize(Number(currentAttachment.size))}
            </span>
            {attachments.length > 1 && (
              <span className="text-sm text-gray-400">
                {currentIndex + 1} / {attachments.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={currentAttachment.filename}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={closePreview}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body with navigation */}
        <div className="relative flex-1 overflow-hidden">
          {/* Previous button */}
          {hasPrevious && (
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Preview content */}
          <AttachmentPreviewContent attachment={currentAttachment} />

          {/* Next button */}
          {hasNext && (
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              title="Next (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Thumbnail strip (optional - for multiple attachments) */}
        {attachments.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-3 border-t dark:border-gray-700 overflow-x-auto">
            {attachments.map((attachment, index) => (
              <button
                key={attachment.name}
                onClick={() =>
                  useAttachmentPreviewStore.getState().goToIndex(index)
                }
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  index === currentIndex
                    ? "border-primary"
                    : "border-transparent hover:border-gray-300"
                }`}
              >
                <AttachmentThumbnail attachment={attachment} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple thumbnail component
function AttachmentThumbnail({ attachment }: { attachment: Attachment }) {
  if (attachment.type.startsWith("image/")) {
    const thumbnailUrl = `/file/${attachment.name.replace(
      "attachments/",
      ""
    )}/${attachment.filename}?thumbnail=true`;
    return (
      <img
        src={thumbnailUrl}
        alt={attachment.filename}
        className="w-full h-full object-cover"
      />
    );
  }

  // Generic file icon for non-images
  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <span className="text-xs text-gray-500 uppercase">
        {attachment.filename.split(".").pop()}
      </span>
    </div>
  );
}
```

#### Task 3.2: Preview Content Resolver

**File:** `web/src/components/attachment/AttachmentPreviewContent.tsx`

```typescript
import { useMemo } from "react";
import { useAttachmentBlob } from "@/hooks/useAttachmentQueries";
import { getPreviewType } from "./utils/mimeTypeResolver";
import { ImagePreview } from "./previews/ImagePreview";
import { VideoPreview } from "./previews/VideoPreview";
import { AudioPreview } from "./previews/AudioPreview";
import { PDFPreview } from "./previews/PDFPreview";
import { TextPreview } from "./previews/TextPreview";
import { FallbackPreview } from "./previews/FallbackPreview";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

interface AttachmentPreviewContentProps {
  attachment: Attachment;
}

export function AttachmentPreviewContent({
  attachment,
}: AttachmentPreviewContentProps) {
  const previewType = useMemo(
    () => getPreviewType(attachment.type, attachment.filename),
    [attachment.type, attachment.filename]
  );

  // For external links, use directly without fetching blob
  const isExternal = !!attachment.externalLink;
  const blobUrl = isExternal ? attachment.externalLink : undefined;

  const { data, isLoading, error } = useAttachmentBlob(attachment.name, {
    enabled: !isExternal && previewType !== "fallback",
  });

  const src = blobUrl || data?.url || "";
  const downloadUrl = `/file/${attachment.name.replace("attachments/", "")}/${
    attachment.filename
  }`;

  // Handle loading and error states
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <p>Failed to load attachment: {error.message}</p>
      </div>
    );
  }

  // Render appropriate preview component
  switch (previewType) {
    case "image":
      return (
        <ImagePreview
          src={src}
          alt={attachment.filename}
          isLoading={isLoading}
        />
      );

    case "video":
      return (
        <VideoPreview src={src} type={attachment.type} isLoading={isLoading} />
      );

    case "audio":
      return (
        <AudioPreview
          src={src}
          filename={attachment.filename}
          type={attachment.type}
          isLoading={isLoading}
        />
      );

    case "pdf":
      return (
        <PDFPreview
          src={src}
          filename={attachment.filename}
          isLoading={isLoading}
        />
      );

    case "text":
    case "code":
      return (
        <TextPreview
          src={src}
          filename={attachment.filename}
          isLoading={isLoading}
        />
      );

    case "fallback":
    default:
      return (
        <FallbackPreview
          filename={attachment.filename}
          type={attachment.type}
          size={Number(attachment.size)}
          downloadUrl={downloadUrl}
        />
      );
  }
}
```

---

### Phase 4: Integration

#### Task 4.1: Register Modal in App Root

**File:** `web/src/App.tsx` (or root layout component)

Add the modal component to render globally:

```typescript
// ...existing imports...
import { AttachmentPreviewModal } from "@/components/attachment/AttachmentPreviewModal";

function App() {
  return (
    // ...existing code...
    <>
      {/* ...existing routes and components... */}
      <AttachmentPreviewModal />
    </>
  );
}
```

#### Task 4.2: Update Attachment Display Component

eFind the existing component that displays attachment icons in memos and update it to trigger the prview modal.

**File:** (Locate existing attachment icon component, likely in `web/src/components/memo/` or similar)

```typescript
import { useAttachmentPreviewStore } from "@/components/attachment/hooks/useAttachmentPreview";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

interface AttachmentIconProps {
  attachment: Attachment;
  allAttachments?: Attachment[]; // All attachments in the memo for navigation
}

export function AttachmentIcon({
  attachment,
  allAttachments = [],
}: AttachmentIconProps) {
  const openPreview = useAttachmentPreviewStore((state) => state.openPreview);

  const handleClick = () => {
    openPreview(attachment, allAttachments);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
    >
      {/* ...existing icon rendering... */}
    </button>
  );
}
```

#### Task 4.3: Update Memo Detail Page

Ensure the memo detail page passes all attachments to enable navigation:

```typescript
// In memo detail component
const attachments = memo.attachments || [];

return (
  <div>
    {/* ...memo content... */}

    {attachments.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-4">
        {attachments.map((attachment) => (
          <AttachmentIcon
            key={attachment.name}
            attachment={attachment}
            allAttachments={attachments}
          />
        ))}
      </div>
    )}
  </div>
);
```

---

### Phase 5: Backend Enhancements (Optional)

#### Task 5.1: Thumbnail Endpoint

Add thumbnail generation for faster image previews in the thumbnail strip.

**File:** `server/router/fileserver/fileserver.go`

```go
// Add thumbnail query parameter support
// GET /file/{name}/{filename}?thumbnail=true

func (s *FileServer) handleThumbnail(w http.ResponseWriter, r *http.Request, attachment *store.Attachment) {
    // Check if thumbnail exists in cache
    thumbnailPath := filepath.Join(ThumbnailCacheFolder, attachment.UID+".webp")

    if _, err := os.Stat(thumbnailPath); os.IsNotExist(err) {
        // Generate thumbnail using existing thumbnail logic
        // Resize to 128x128, convert to WebP
    }

    // Serve thumbnail
    http.ServeFile(w, r, thumbnailPath)
}
```

#### Task 5.2: Content-Disposition Header

Ensure proper headers for inline viewing vs download:

```go
// For preview (inline viewing)
w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", attachment.Filename))

// For download
w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", attachment.Filename))
```

---

## Testing Plan

### Unit Tests

1. **MIME Type Resolver**

   - Test all supported MIME types map to correct preview types
   - Test file extension fallback logic
   - Test edge cases (unknown types, malformed input)

2. **Preview State Store**
   - Test navigation (next, previous, goToIndex)
   - Test boundary conditions (first/last item)
   - Test open/close state transitions

### Integration Tests

1. **Modal Interaction**

   - Open modal on attachment click
   - Close with Escape key
   - Close with backdrop click
   - Navigation with arrow keys

2. **Preview Components**
   - Image loads and displays correctly
   - Video plays with controls
   - Audio plays with controls
   - PDF renders or shows fallback
   - Text/code displays with syntax highlighting
   - Fallback shows download option

### E2E Tests

1. **Full User Flow**
   - Create memo with attachments
   - Navigate to memo detail
   - Click attachment icon
   - Verify preview opens
   - Navigate between attachments
   - Download attachment
   - Close modal

---

## Dependencies

### New NPM Packages (Optional)

| Package                     | Purpose                      | Required?                         |
| --------------------------- | ---------------------------- | --------------------------------- |
| `zustand`                   | State management for preview | Already in project or use Context |
| `react-zoom-pan-pinch`      | Better image zoom/pan        | Optional enhancement              |
| `highlight.js` or `shiki`   | Syntax highlighting for code | Optional enhancement              |
| `react-pdf` or `pdfjs-dist` | Better PDF rendering         | Optional enhancement              |

### Existing Dependencies Used

- `lucide-react` - Icons (already in project)
- `@tanstack/react-query` - Data fetching (already in project)
- Tailwind CSS - Styling (already in project)

---

## File Structure Summary

```
web/src/
├── components/
│   └── attachment/
│       ├── AttachmentPreviewModal.tsx
│       ├── AttachmentPreviewContent.tsx
│       ├── hooks/
│       │   └── useAttachmentPreview.ts
│       ├── previews/
│       │   ├── ImagePreview.tsx
│       │   ├── VideoPreview.tsx
│       │   ├── AudioPreview.tsx
│       │   ├── PDFPreview.tsx
│       │   ├── TextPreview.tsx
│       │   └── FallbackPreview.tsx
│       └── utils/
│           └── mimeTypeResolver.ts
├── hooks/
│   └── useAttachmentQueries.ts  # Add useAttachmentBlob hook
└── lib/
    └── utils.ts                  # Add formatFileSize if not exists
```

---

## Success Metrics

1. **Performance**: Preview modal opens in < 500ms for cached attachments
2. **Compatibility**: Works in Chrome, Firefox, Safari, Edge
3. **Accessibility**: Keyboard navigable, proper focus management
4. **Responsiveness**: Works on mobile, tablet, and desktop
5. **Error Handling**: Graceful fallback for unsupported types or network errors

---

## Future Enhancements

1. **Lazy Loading**: Load previews only when visible in thumbnail strip
2. **Preloading**: Preload next/previous attachment for faster navigation
3. **Full-screen Mode**: Dedicated full-screen viewer with gestures
4. **Annotation**: Add ability to annotate images/PDFs
5. **Share**: Generate shareable links for attachments
6. **AI Integration**: OCR for images, transcription for audio/video

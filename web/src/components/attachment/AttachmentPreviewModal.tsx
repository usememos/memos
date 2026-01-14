import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { formatFileSize } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { AttachmentPreviewContent } from "./AttachmentPreviewContent";
import { useAttachmentPreview } from "./hooks/useAttachmentPreview";

export function AttachmentPreviewModal() {
  const { isOpen, currentAttachment, attachments, currentIndex, closePreview, goToNext, goToPrevious, goToIndex } = useAttachmentPreview();

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
    [isOpen, hasNext, hasPrevious, closePreview, goToNext, goToPrevious],
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

  const downloadUrl = getAttachmentUrl(currentAttachment);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closePreview} />

      {/* Modal content */}
      <div className="relative z-10 w-full h-full max-w-7xl max-h-[90vh] m-4 flex flex-col bg-background rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate">{currentAttachment.filename}</h3>
            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">
              {currentAttachment.type} • {formatFileSize(Number(currentAttachment.size))}
            </span>
            {attachments.length > 1 && (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {currentIndex + 1} / {attachments.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <a
              href={downloadUrl}
              download={currentAttachment.filename}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={closePreview}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
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

        {/* Thumbnail strip (for multiple attachments) */}
        {attachments.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-3 border-t overflow-x-auto">
            {attachments.map((attachment: Attachment, index: number) => (
              <button
                key={attachment.name}
                onClick={() => goToIndex(index)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  index === currentIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
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
    const thumbnailUrl = `${window.location.origin}/file/${attachment.name}/${attachment.filename}?thumbnail=true`;
    return <img src={thumbnailUrl} alt={attachment.filename} className="w-full h-full object-cover" loading="lazy" />;
  }

  // Generic file icon for non-images
  const ext = attachment.filename.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div className="w-full h-full bg-muted flex items-center justify-center">
      <span className="text-xs text-muted-foreground font-medium">{ext.substring(0, 4)}</span>
    </div>
  );
}

import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PreviewMediaItem } from "@/utils/media-item";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls?: string[];
  items?: PreviewMediaItem[];
  initialIndex?: number;
}

function PreviewImageDialog({ open, onOpenChange, imgUrls = [], items, initialIndex = 0 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const previewItems =
    items ?? imgUrls.map((url) => ({ id: url, kind: "image" as const, sourceUrl: url, posterUrl: url, filename: "Image" }));

  // Update current index when initialIndex prop changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case "Escape":
          onOpenChange(false);
          break;
        case "ArrowRight":
          setCurrentIndex((prev) => Math.min(prev + 1, previewItems.length - 1));
          break;
        case "ArrowLeft":
          setCurrentIndex((prev) => Math.max(prev - 1, 0));
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  // Return early if no images provided
  if (!previewItems.length) return null;

  // Ensure currentIndex is within bounds
  const safeIndex = Math.max(0, Math.min(currentIndex, previewItems.length - 1));
  const currentItem = previewItems[safeIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[100vw] !h-[100vh] !max-w-[100vw] !max-h-[100vw] p-0 border-0 shadow-none bg-transparent [&>button]:hidden"
        aria-describedby="image-preview-description"
      >
        {/* Close button */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleClose}
            variant="secondary"
            size="icon"
            className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm"
            aria-label="Close image preview"
          >
            <X className="h-4 w-4 text-popover-foreground" />
          </Button>
        </div>

        {/* Image container */}
        <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto" onClick={handleBackdropClick}>
          {currentItem.kind === "video" ? (
            <video
              key={currentItem.id}
              src={currentItem.sourceUrl}
              poster={currentItem.posterUrl}
              className="max-w-full max-h-full object-contain"
              controls
              autoPlay
            />
          ) : currentItem.kind === "motion" ? (
            <MotionPhotoPreview
              key={currentItem.id}
              posterUrl={currentItem.posterUrl}
              motionUrl={currentItem.motionUrl}
              alt={`Preview live photo ${safeIndex + 1} of ${previewItems.length}`}
              presentationTimestampUs={currentItem.presentationTimestampUs}
              badgeClassName="left-4 top-4"
              mediaClassName="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-h-[calc(100vh-4rem)] sm:max-w-[calc(100vw-4rem)]"
            />
          ) : (
            <img
              src={currentItem.sourceUrl}
              alt={`Preview image ${safeIndex + 1} of ${previewItems.length}`}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
              loading="eager"
              decoding="async"
            />
          )}
        </div>

        {/* Screen reader description */}
        <div id="image-preview-description" className="sr-only">
          Attachment preview dialog. Press Escape to close or click outside the media.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewImageDialog;

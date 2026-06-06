import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { PreviewMediaItem } from "@/utils/media-item";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls?: string[];
  items?: PreviewMediaItem[];
  initialIndex?: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const DOUBLE_TAP_ZOOM = 2;

const clampZoom = (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

function PreviewImageDialog({ open, onOpenChange, imgUrls = [], items, initialIndex = 0 }: Props) {
  const sm = useMediaQuery("sm");
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const previewItems = useMemo(
    () => items ?? imgUrls.map((url) => ({ id: url, kind: "image" as const, sourceUrl: url, posterUrl: url, filename: "Image" })),
    [imgUrls, items],
  );

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, open]);

  const itemCount = previewItems.length;
  const safeIndex = Math.max(0, Math.min(currentIndex, itemCount - 1));
  const currentItem = previewItems[safeIndex];
  const hasMultiple = itemCount > 1;
  const isImagePreview = currentItem?.kind === "image";
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < itemCount - 1;
  const zoomPercent = Math.round(zoomScale * 100);
  const isZoomed = zoomScale > MIN_ZOOM;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) {
        return;
      }

      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }

      if (event.key === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "ArrowRight") {
        setCurrentIndex((prev) => Math.min(prev + 1, itemCount - 1));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [itemCount, onOpenChange, open]);

  useEffect(() => {
    setZoomScale(MIN_ZOOM);
  }, [currentItem?.id, open]);

  const handleClose = () => onOpenChange(false);
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };
  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, itemCount - 1));
  };

  const updateZoom = (nextScale: number) => {
    setZoomScale(clampZoom(nextScale));
  };
  const resetZoom = () => setZoomScale(MIN_ZOOM);
  const handleZoomIn = () => updateZoom(zoomScale + ZOOM_STEP);
  const handleZoomOut = () => updateZoom(zoomScale - ZOOM_STEP);
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isImagePreview) {
      event.preventDefault();
      updateZoom(zoomScale + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }
  };
  const handleDoubleClick = () => setZoomScale((scale) => (scale === MIN_ZOOM ? DOUBLE_TAP_ZOOM : MIN_ZOOM));

  if (!itemCount || !currentItem) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!h-[100vh] !w-[100vw] !max-h-[100vh] !max-w-[100vw] overflow-hidden border-0 bg-black/92 p-0 shadow-none"
      >
        <VisuallyHidden>
          <DialogTitle>{currentItem.filename || "Attachment preview"}</DialogTitle>
          <DialogDescription>
            Attachment preview dialog. Press Escape to close, use left or right arrow keys to switch items, and zoom images with the
            controls, mouse wheel, or double tap.
          </DialogDescription>
        </VisuallyHidden>

        <div className="absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/70 via-black/35 to-transparent px-3 pb-6 pt-3 sm:px-5 sm:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-white">
              <div className="truncate text-sm font-medium">{currentItem.filename || "Attachment"}</div>
              {hasMultiple && (
                <div className="mt-1 text-xs text-white/70">
                  {safeIndex + 1} / {itemCount}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full bg-white/10 text-white hover:bg-white/16 hover:text-white"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          data-testid={isImagePreview ? "preview-zoom-surface" : undefined}
          className={cn(
            "flex h-full w-full items-center justify-center px-3 pb-20 pt-16 sm:px-16 sm:pb-8 sm:pt-20",
            isImagePreview && "cursor-zoom-in",
          )}
          onWheel={handleWheel}
          onClick={(event) => {
            if (event.target === event.currentTarget && !isZoomed) {
              handleClose();
            }
          }}
        >
          <div className="flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            {currentItem.kind === "video" ? (
              <video
                key={currentItem.id}
                src={currentItem.sourceUrl}
                poster={currentItem.posterUrl}
                className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-md object-contain sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
                controls
                autoPlay
                playsInline
              />
            ) : currentItem.kind === "motion" ? (
              <MotionPhotoPreview
                key={currentItem.id}
                posterUrl={currentItem.posterUrl}
                motionUrl={currentItem.motionUrl}
                alt={`Preview live photo ${safeIndex + 1} of ${itemCount}`}
                presentationTimestampUs={currentItem.presentationTimestampUs}
                badgeClassName="left-3 top-3 sm:left-4 sm:top-4"
                mediaClassName="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-md object-contain sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
              />
            ) : (
              <img
                src={currentItem.sourceUrl}
                alt={`Preview image ${safeIndex + 1} of ${itemCount}`}
                className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-md object-contain select-none sm:max-h-[calc(100vh-7rem)] sm:max-w-[calc(100vw-8rem)]"
                style={{
                  transform: `translate3d(0px, 0px, 0) scale(${zoomScale})`,
                  transition: "transform 120ms ease-out",
                  transformOrigin: "center center",
                }}
                onDoubleClick={handleDoubleClick}
                draggable={false}
                loading="eager"
                decoding="async"
              />
            )}
          </div>
        </div>

        {isImagePreview && (
          <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3 pt-6">
            <div className="mx-auto flex w-fit items-center gap-1 rounded-full bg-black/60 px-2 py-2 text-white shadow-lg backdrop-blur-sm">
              {hasMultiple && !sm && (
                <>
                  <ZoomButton label="Previous item" onClick={handlePrevious} disabled={!canGoPrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </ZoomButton>
                  <div className="min-w-9 px-1 text-center text-xs font-medium tabular-nums text-white/75">
                    {safeIndex + 1}/{itemCount}
                  </div>
                  <ZoomButton label="Next item" onClick={handleNext} disabled={!canGoNext}>
                    <ChevronRight className="h-4 w-4" />
                  </ZoomButton>
                  <div className="mx-1 h-5 w-px bg-white/18" />
                </>
              )}
              <ZoomButton label="Zoom out" onClick={handleZoomOut} disabled={zoomScale === MIN_ZOOM}>
                <ZoomOut className="h-4 w-4" />
              </ZoomButton>
              <div className="min-w-12 px-2 text-center text-xs font-medium tabular-nums text-white/80">{zoomPercent}%</div>
              <ZoomButton label="Zoom in" onClick={handleZoomIn} disabled={zoomScale === MAX_ZOOM}>
                <ZoomIn className="h-4 w-4" />
              </ZoomButton>
              <div className="mx-1 h-5 w-px bg-white/18" />
              <ZoomButton label="Reset zoom" onClick={resetZoom} disabled={!isZoomed}>
                <RotateCcw className="h-4 w-4" />
              </ZoomButton>
            </div>
          </div>
        )}

        {hasMultiple && sm && (
          <>
            <NavButton
              side="left"
              disabled={!canGoPrevious}
              label="Previous item"
              onClick={handlePrevious}
              icon={<ChevronLeft className="h-5 w-5" />}
            />
            <NavButton
              side="right"
              disabled={!canGoNext}
              label="Next item"
              onClick={handleNext}
              icon={<ChevronRight className="h-5 w-5" />}
            />
          </>
        )}

        {hasMultiple && !sm && !isImagePreview && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-6">
            <div className="mx-auto flex max-w-xs items-center justify-between rounded-full bg-black/55 px-2 py-2 backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevious}
                disabled={!canGoPrevious}
                className="rounded-full px-3 text-white hover:bg-white/10 hover:text-white disabled:text-white/35"
              >
                Prev
              </Button>
              <div className="px-3 text-xs text-white/75">
                {safeIndex + 1} / {itemCount}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNext}
                disabled={!canGoNext}
                className="rounded-full px-3 text-white hover:bg-white/10 hover:text-white disabled:text-white/35"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NavButtonProps {
  side: "left" | "right";
  disabled: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}

const NavButton = ({ side, disabled, label, onClick, icon }: NavButtonProps) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    disabled={disabled}
    onClick={onClick}
    aria-label={label}
    className={cn(
      "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/16 hover:text-white disabled:opacity-25 sm:flex",
      side === "left" ? "left-4" : "right-4",
    )}
  >
    {icon}
  </Button>
);

const ZoomButton = ({
  disabled,
  label,
  onClick,
  children,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    disabled={disabled}
    onClick={onClick}
    aria-label={label}
    className="h-9 w-9 rounded-full text-white hover:bg-white/12 hover:text-white disabled:text-white/35"
  >
    {children}
  </Button>
);

export default PreviewImageDialog;

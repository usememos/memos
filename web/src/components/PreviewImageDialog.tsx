import { Button, Dialog } from "@usememos/ui";
import { ChevronLeft, ChevronRight, InfoIcon, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import MediaMetadataDetails from "@/components/MediaMetadataDetails";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
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
const SWIPE_THRESHOLD = 60;
const SWIPE_DIRECTION_RATIO = 1.5;

const clampZoom = (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

interface PanOffset {
  x: number;
  y: number;
}

const NO_PAN: PanOffset = { x: 0, y: 0 };

const clampPan = (offset: number, max: number) => Math.min(max, Math.max(-max, offset));

// The image is centered in the surface's content box, so each axis clamps to half of its overflow.
const clampPanOffset = (offset: PanOffset, scale: number, image: HTMLImageElement | null, surface: HTMLDivElement | null): PanOffset => {
  if (!image || !surface) {
    return offset;
  }
  const style = window.getComputedStyle(surface);
  const contentWidth = surface.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0);
  const contentHeight = surface.clientHeight - (Number.parseFloat(style.paddingTop) || 0) - (Number.parseFloat(style.paddingBottom) || 0);
  const maxX = Math.max(0, (image.offsetWidth * scale - contentWidth) / 2);
  const maxY = Math.max(0, (image.offsetHeight * scale - contentHeight) / 2);
  return { x: clampPan(offset.x, maxX), y: clampPan(offset.y, maxY) };
};

interface PinchGesture {
  startCenterX: number;
  startCenterY: number;
  startDistance: number;
  startMidpointX: number;
  startMidpointY: number;
  startScale: number;
  startPan: PanOffset;
}

interface SwipeGesture {
  pointerId: number;
  startX: number;
  startY: number;
}

const distanceBetween = (first: { x: number; y: number }, second: { x: number; y: number }) =>
  Math.hypot(first.x - second.x, first.y - second.y);

function PreviewImageDialog({ open, onOpenChange, imgUrls = [], items, initialIndex = 0 }: Props) {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const [showDetails, setShowDetails] = useState(false);
  const [panOffset, setPanOffset] = useState<PanOffset>(NO_PAN);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pinchRef = useRef<PinchGesture | null>(null);
  const swipeRef = useRef<SwipeGesture | null>(null);
  const previewItems = useMemo(
    () => items ?? imgUrls.map((url) => ({ id: url, kind: "image" as const, sourceUrl: url, posterUrl: url, filename: "Image" })),
    [imgUrls, items],
  );

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setShowDetails(false);
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
    const drag = panDragRef.current;
    if (drag && imageRef.current?.hasPointerCapture(drag.pointerId)) {
      imageRef.current.releasePointerCapture(drag.pointerId);
    }
    panDragRef.current = null;
    pointersRef.current.clear();
    pinchRef.current = null;
    swipeRef.current = null;
    setZoomScale(MIN_ZOOM);
    setPanOffset(NO_PAN);
    setSwipeOffset(0);
    setIsInteracting(false);
  }, [currentItem?.id, open]);

  useEffect(() => {
    if (zoomScale === MIN_ZOOM) {
      panDragRef.current = null;
      if (!pinchRef.current) {
        setIsInteracting(false);
      }
    }
    setPanOffset((current) => {
      if (zoomScale === MIN_ZOOM) {
        return NO_PAN;
      }
      return clampPanOffset(current, zoomScale, imageRef.current, surfaceRef.current);
    });
  }, [zoomScale]);

  const handleClose = () => onOpenChange(false);
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };
  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, itemCount - 1));
  };
  // The dialog popup stops arrow keys from reaching the document, so navigation listens on the popup itself.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      handleNext();
    }
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

  const startPan = (pointerId: number, point: { x: number; y: number }) => {
    panDragRef.current = { pointerId, startX: point.x, startY: point.y, originX: panOffset.x, originY: panOffset.y };
    setIsInteracting(true);
  };

  const startPinch = () => {
    const [first, second] = [...pointersRef.current.values()];
    // The untransformed wrapper shares the image's layout center, which the pan offset is measured from.
    const rect = imageRef.current?.parentElement?.getBoundingClientRect();
    const startCenterX = rect ? rect.left + rect.width / 2 : 0;
    const startCenterY = rect ? rect.top + rect.height / 2 : 0;
    pinchRef.current = {
      startCenterX,
      startCenterY,
      startDistance: distanceBetween(first, second),
      startMidpointX: (first.x + second.x) / 2 - startCenterX,
      startMidpointY: (first.y + second.y) / 2 - startCenterY,
      startScale: zoomScale,
      startPan: panOffset,
    };
    panDragRef.current = null;
    swipeRef.current = null;
    setSwipeOffset(0);
    setIsInteracting(true);
  };

  const updatePinch = () => {
    const pinch = pinchRef.current;
    const [first, second] = [...pointersRef.current.values()];
    if (!pinch || !first || !second) {
      return;
    }
    const nextScale = clampZoom(pinch.startScale * (distanceBetween(first, second) / pinch.startDistance));
    if (nextScale === MIN_ZOOM) {
      setZoomScale(MIN_ZOOM);
      setPanOffset(NO_PAN);
      return;
    }
    // Anchor the image point under the moving midpoint as the fingers scale it.
    const ratio = nextScale / pinch.startScale;
    const midpointX = (first.x + second.x) / 2 - pinch.startCenterX;
    const midpointY = (first.y + second.y) / 2 - pinch.startCenterY;
    const next = {
      x: midpointX - (pinch.startMidpointX - pinch.startPan.x) * ratio,
      y: midpointY - (pinch.startMidpointY - pinch.startPan.y) * ratio,
    };
    setPanOffset(clampPanOffset(next, nextScale, imageRef.current, surfaceRef.current));
    setZoomScale(nextScale);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      startPinch();
    } else if (isZoomed) {
      startPan(event.pointerId, { x: event.clientX, y: event.clientY });
    } else if (hasMultiple) {
      swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchRef.current) {
      updatePinch();
      return;
    }
    const swipe = swipeRef.current;
    if (swipe && swipe.pointerId === event.pointerId) {
      setSwipeOffset(event.clientX - swipe.startX);
      setIsInteracting(true);
      return;
    }
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const next = { x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY };
    setPanOffset(clampPanOffset(next, zoomScale, imageRef.current, surfaceRef.current));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLImageElement>, cancelled = false) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchRef.current = null;
    }
    if (pointers.size === 1) {
      // Re-anchor the drag on the remaining finger so a pinch lift does not jump.
      const [remainingId, remaining] = [...pointers.entries()][0];
      if (isZoomed) {
        panDragRef.current = {
          pointerId: remainingId,
          startX: remaining.x,
          startY: remaining.y,
          originX: panOffset.x,
          originY: panOffset.y,
        };
      } else {
        panDragRef.current = null;
        setIsInteracting(false);
      }
      return;
    }
    if (pointers.size === 0) {
      const swipe = swipeRef.current;
      if (!cancelled && swipe && swipe.pointerId === event.pointerId) {
        const deltaX = event.clientX - swipe.startX;
        const deltaY = event.clientY - swipe.startY;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) {
          if (deltaX < 0) {
            handleNext();
          } else {
            handlePrevious();
          }
        }
      }
      swipeRef.current = null;
      setSwipeOffset(0);
      panDragRef.current = null;
      setIsInteracting(false);
    }
  };

  if (!itemCount || !currentItem) {
    return null;
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && showDetails && eventDetails.reason === "escape-key") {
          eventDetails.cancel();
          setShowDetails(false);
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Popup variant="bare" fullScreen onKeyDown={handleKeyDown}>
        <div className="absolute inset-0 bg-black/92">
          <div className="mu-visually-hidden">
            <Dialog.Title>{currentItem.filename || t("attachment-preview.title")}</Dialog.Title>
            <Dialog.Description>{t("attachment-preview.description")}</Dialog.Description>
          </div>

          <div
            className={cn(
              "absolute inset-x-0 top-0 z-50 bg-linear-to-b from-black/70 via-black/35 to-transparent px-3 pb-6 pt-3 sm:px-5 sm:pt-4",
              showDetails && "lg:pr-[23rem]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-mu-text" data-theme="dark">
                <div className="truncate mu-label">{currentItem.filename || t("attachment-preview.title")}</div>
                {hasMultiple && (
                  <div className="mt-1 mu-caption text-mu-text-secondary">
                    {safeIndex + 1} / {itemCount}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5" data-theme="dark">
                <Button
                  onClick={() => setShowDetails((visible) => !visible)}
                  aria-label={showDetails ? t("attachment-details.actions.hide") : t("attachment-details.actions.show")}
                  aria-expanded={showDetails}
                  aria-controls="attachment-media-details"
                  icon={<InfoIcon />}
                />
                <Button onClick={handleClose} aria-label={t("attachment-preview.close")} icon={<X />} />
              </div>
            </div>
          </div>

          <div
            ref={surfaceRef}
            data-testid={isImagePreview ? "preview-zoom-surface" : undefined}
            className={cn(
              "flex h-full w-full items-center justify-center px-3 pb-20 pt-16 sm:px-16 sm:pb-8 sm:pt-20",
              isImagePreview && !isZoomed && "cursor-zoom-in",
              showDetails && "lg:pr-[26rem]",
            )}
            onWheel={handleWheel}
            onClick={(event) => {
              if (event.target === event.currentTarget && !isZoomed) {
                if (showDetails) {
                  setShowDetails(false);
                } else {
                  handleClose();
                }
              }
            }}
          >
            <div className="flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
              {currentItem.kind === "video" ? (
                <video
                  key={currentItem.id}
                  src={currentItem.sourceUrl}
                  poster={currentItem.posterUrl}
                  className={cn(
                    "max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-mu-md object-contain sm:max-h-[calc(100dvh-7rem)] sm:max-w-[calc(100vw-8rem)]",
                    showDetails && "lg:max-w-[calc(100vw-30rem)]",
                  )}
                  controls
                  autoPlay
                  playsInline
                />
              ) : currentItem.kind === "motion" ? (
                <MotionPhotoPreview
                  key={currentItem.id}
                  posterUrl={currentItem.posterUrl}
                  motionUrl={currentItem.motionUrl}
                  alt={t("attachment-preview.live-photo-alt", { index: safeIndex + 1, count: itemCount })}
                  presentationTimestampUs={currentItem.presentationTimestampUs}
                  badgeClassName="left-3 top-3 sm:left-4 sm:top-4"
                  mediaClassName={cn(
                    "max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-mu-md object-contain sm:max-h-[calc(100dvh-7rem)] sm:max-w-[calc(100vw-8rem)]",
                    showDetails && "lg:max-w-[calc(100vw-30rem)]",
                  )}
                />
              ) : (
                <img
                  ref={imageRef}
                  src={currentItem.sourceUrl}
                  alt={t("attachment-preview.image-alt", { index: safeIndex + 1, count: itemCount })}
                  className={cn(
                    "max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-1.5rem)] rounded-mu-md object-contain select-none sm:max-h-[calc(100dvh-7rem)] sm:max-w-[calc(100vw-8rem)]",
                    showDetails && "lg:max-w-[calc(100vw-30rem)]",
                    (isZoomed || hasMultiple) && (isInteracting ? "cursor-grabbing" : "cursor-grab"),
                  )}
                  style={{
                    transform: `translate3d(${panOffset.x + swipeOffset}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                    transition: isInteracting ? "none" : "transform 120ms ease-out",
                    transformOrigin: "center center",
                    touchAction: "none",
                  }}
                  onDoubleClick={handleDoubleClick}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={(event) => handlePointerEnd(event, true)}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              )}
            </div>
          </div>

          {isImagePreview && (
            <div className={cn("absolute inset-x-0 bottom-0 z-30 px-3 pb-3 pt-6", showDetails && "hidden lg:block lg:pr-[22rem]")}>
              {/* The bar keeps its glass so the counter and zoom readout stay legible over the photo. */}
              <div data-theme="dark" className="mx-auto flex w-fit items-center gap-1 rounded-full bg-black/60 px-2 py-2 backdrop-blur-sm">
                {hasMultiple && !sm && (
                  <>
                    <Button
                      aria-label={t("attachment-preview.previous")}
                      onClick={handlePrevious}
                      disabled={!canGoPrevious}
                      icon={<ChevronLeft />}
                    />
                    <div className="min-w-9 px-1 text-center mu-label-sm tabular-nums text-mu-text-secondary">
                      {safeIndex + 1}/{itemCount}
                    </div>
                    <Button aria-label={t("attachment-preview.next")} onClick={handleNext} disabled={!canGoNext} icon={<ChevronRight />} />
                    <div className="mx-1 h-5 w-px bg-mu-line" />
                  </>
                )}
                <Button aria-label={t("map.zoom-out")} onClick={handleZoomOut} disabled={zoomScale === MIN_ZOOM} icon={<ZoomOut />} />
                <div className="min-w-12 px-2 text-center mu-label-sm tabular-nums text-mu-text-secondary">{zoomPercent}%</div>
                <Button aria-label={t("map.zoom-in")} onClick={handleZoomIn} disabled={zoomScale === MAX_ZOOM} icon={<ZoomIn />} />
                <div className="mx-1 h-5 w-px bg-mu-line" />
                <Button aria-label={t("attachment-preview.reset-zoom")} onClick={resetZoom} disabled={!isZoomed} icon={<RotateCcw />} />
              </div>
            </div>
          )}

          {hasMultiple && sm && (
            <>
              <NavButton
                side="left"
                disabled={!canGoPrevious}
                label={t("attachment-preview.previous")}
                onClick={handlePrevious}
                icon={<ChevronLeft />}
              />
              <NavButton
                side="right"
                disabled={!canGoNext}
                label={t("attachment-preview.next")}
                onClick={handleNext}
                icon={<ChevronRight />}
                detailsOpen={showDetails}
              />
            </>
          )}

          {hasMultiple && !sm && !isImagePreview && !showDetails && (
            <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 pt-6">
              <div
                data-theme="dark"
                className="mx-auto flex max-w-xs items-center justify-between rounded-full bg-black/55 px-2 py-2 backdrop-blur-sm"
              >
                <Button size="sm" onClick={handlePrevious} disabled={!canGoPrevious}>
                  {t("common.previous")}
                </Button>
                <div className="px-3 mu-caption text-mu-text-secondary">
                  {safeIndex + 1} / {itemCount}
                </div>
                <Button size="sm" onClick={handleNext} disabled={!canGoNext}>
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}

          {showDetails && <MediaMetadataDetails id="attachment-media-details" item={currentItem} onClose={() => setShowDetails(false)} />}
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

interface NavButtonProps {
  side: "left" | "right";
  disabled: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactElement;
  detailsOpen?: boolean;
}

/** Previous and next at the screen's sides; the wrapper places the key and makes it a dark key over the photo. */
const NavButton = ({ side, disabled, label, onClick, icon, detailsOpen = false }: NavButtonProps) => (
  <div
    data-theme="dark"
    className={cn(
      "absolute top-1/2 z-20 -translate-y-1/2",
      side === "left" ? "left-4" : detailsOpen ? "right-4 lg:right-[23rem]" : "right-4",
    )}
  >
    <Button aria-label={label} onClick={onClick} disabled={disabled} icon={icon} />
  </div>
);

export default PreviewImageDialog;

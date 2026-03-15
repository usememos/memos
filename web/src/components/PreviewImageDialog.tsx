import * as exifr from "exifr";
import { InfoIcon, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imgUrls: string[];
  initialIndex?: number;
}

interface ReadableDetails {
  shotTime: string;
  fileInfo: string;
  shootingParams: string;
  filePath: string;
  location: string;
}

function PreviewImageDialog({ open, onOpenChange, imgUrls, initialIndex = 0 }: Props) {
  const MAX_SCALE = 5;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [readableDetails, setReadableDetails] = useState<ReadableDetails | null>(null);
  const [locationCopied, setLocationCopied] = useState(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) return "-";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** unitIndex;
    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
  };

  const formatDateTime = (value: unknown): string => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  };

  const formatExposureTime = (value: unknown): string => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
    if (value >= 1) return `${value.toFixed(value % 1 === 0 ? 0 : 1)}s`;
    const denominator = Math.round(1 / value);
    return denominator > 0 ? `1/${denominator}s` : "";
  };

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildReadableDetails = (
    exifDetails: Record<string, unknown>,
    imageUrl: string,
    blob: Blob,
    imageEl: HTMLImageElement | null,
  ): ReadableDetails => {
    const unavailable = "暂无";
    const fileNameFromUrl = (() => {
      const pathname = imageUrl.split("?")[0]?.split("#")[0] || "";
      const leaf = pathname.split("/").pop() || "";
      try {
        return decodeURIComponent(leaf);
      } catch {
        return leaf;
      }
    })();

    const fileName = formatDetailValue(exifDetails.FileName) || formatDetailValue(exifDetails.fileName) || fileNameFromUrl || unavailable;
    const width = imageEl?.naturalWidth || toNumber(exifDetails.ExifImageWidth) || toNumber(exifDetails.ImageWidth) || null;
    const height = imageEl?.naturalHeight || toNumber(exifDetails.ExifImageHeight) || toNumber(exifDetails.ImageHeight) || null;
    const sizePart = formatBytes(blob.size);
    const resolutionPart = width && height ? `${width}x${height}px` : unavailable;

    const make = formatDetailValue(exifDetails.Make);
    const model = formatDetailValue(exifDetails.Model);
    const lens = formatDetailValue(exifDetails.LensModel) || formatDetailValue(exifDetails.LensInfo);
    const fNumber = toNumber(exifDetails.FNumber);
    const exposure = formatExposureTime(exifDetails.ExposureTime);
    const iso = formatDetailValue(exifDetails.ISO);
    const focal = toNumber(exifDetails.FocalLength);
    const focal35 = toNumber(exifDetails.FocalLengthIn35mmFormat);
    const flashRaw = formatDetailValue(exifDetails.Flash);
    const profile =
      formatDetailValue(exifDetails.ProfileName) || formatDetailValue(exifDetails.PresetName) || formatDetailValue(exifDetails.ColorMode);

    const cameraName = [make, model].filter(Boolean).join(" ").trim();
    const exposureParts = [
      fNumber ? `f/${fNumber}` : "",
      exposure,
      iso ? `ISO${iso}` : "",
      focal ? `${focal}mm${focal35 ? `(等效焦距${focal35}mm)` : ""}` : "",
    ].filter(Boolean);
    const cameraParts = [
      [cameraName, lens].filter(Boolean).join(", "),
      exposureParts.join(" "),
      flashRaw ? (flashRaw.toLowerCase().includes("fired") ? "已使用闪光灯" : "未使用闪光灯") : "",
      profile,
    ].filter(Boolean);

    const directory = formatDetailValue(exifDetails.Directory) || formatDetailValue(exifDetails.Path);
    const fullPath = directory && fileName ? `${directory}/${fileName}` : directory || fileName;

    const locationName = [
      formatDetailValue(exifDetails.Location),
      formatDetailValue(exifDetails.SubLocation),
      formatDetailValue(exifDetails.City),
      formatDetailValue(exifDetails.State),
      formatDetailValue(exifDetails.Country),
    ]
      .filter(Boolean)
      .join(" ");
    const destinationDistance =
      toNumber(exifDetails.GPSDestDistance) !== null
        ? `${toNumber(exifDetails.GPSDestDistance)}米`
        : formatDetailValue(exifDetails.GPSDestDistance);

    const lat = toNumber(exifDetails.latitude ?? exifDetails.GPSLatitude);
    const lng = toNumber(exifDetails.longitude ?? exifDetails.GPSLongitude);
    const altitude = toNumber(exifDetails.GPSAltitude);
    const gpsText = [
      lat !== null ? `纬度: ${lat.toFixed(6)}` : "",
      lng !== null ? `经度: ${lng.toFixed(6)}` : "",
      altitude !== null ? `海拔: ${altitude}m` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const locationText = locationName ? (destinationDistance ? `${locationName}附近${destinationDistance}` : locationName) : gpsText;

    const shotTime =
      formatDateTime(exifDetails.DateTimeOriginal) ||
      formatDateTime(exifDetails.CreateDate) ||
      formatDateTime(exifDetails.ModifyDate) ||
      unavailable;

    return {
      shotTime,
      fileInfo: [fileName, sizePart, resolutionPart].filter(Boolean).join("  "),
      shootingParams: cameraParts.join(" ") || unavailable,
      filePath: fullPath || unavailable,
      location: locationText || unavailable,
    };
  };

  const formatDetailValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return String(value);
    if (Array.isArray(value)) {
      return value
        .map((item) => formatDetailValue(item))
        .filter(Boolean)
        .join(", ");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const loadImageDetails = async () => {
    const imageUrl = imgUrls[Math.max(0, Math.min(currentIndex, imgUrls.length - 1))];
    const imageEl = imgRef.current;

    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`加载图片数据失败: ${response.status}`);
      }

      const blob = await response.blob();
      const exifData = await exifr.parse(blob, { tiff: true, xmp: true, icc: true, iptc: true, jfif: true, ihdr: true });
      const exifDetails = exifData && typeof exifData === "object" ? (exifData as Record<string, unknown>) : {};

      setReadableDetails(buildReadableDetails(exifDetails, imageUrl, blob, imageEl));
    } catch (error) {
      setReadableDetails(null);
      setDetailsError(error instanceof Error ? error.message : "读取图片详细数据失败");
    } finally {
      setDetailsLoading(false);
    }
  };

  const clampTranslate = (nextScale: number, nextTranslate: { x: number; y: number }) => {
    const frame = frameRef.current;
    const image = imgRef.current;
    if (!frame || !image || !image.naturalWidth || !image.naturalHeight) {
      return nextTranslate;
    }

    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const frameAspect = frameWidth / frameHeight;

    const baseWidth = imageAspect > frameAspect ? frameWidth : frameHeight * imageAspect;
    const baseHeight = imageAspect > frameAspect ? frameWidth / imageAspect : frameHeight;

    const maxOffsetX = Math.max(0, (baseWidth * nextScale - frameWidth) / 2);
    const maxOffsetY = Math.max(0, (baseHeight * nextScale - frameHeight) / 2);

    return {
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextTranslate.x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextTranslate.y)),
    };
  };

  // Update current index when initialIndex prop changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    // reset transform when image changes or dialog opens
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    initialPinchDistanceRef.current = null;
    initialScaleRef.current = 1;
    isPanningRef.current = false;
    setDetailsOpen(false);
    setReadableDetails(null);
    setDetailsError(null);
    setLocationCopied(false);
  }, [currentIndex, open]);

  useEffect(() => {
    if (!detailsOpen || !open) return;
    void loadImageDetails();
  }, [detailsOpen, open, currentIndex]);

  useEffect(() => {
    if (!open) return;

    const handleResize = () => {
      setTranslate((prev) => clampTranslate(scale, prev));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, scale]);

  // Mouse move/up handlers for panning
  const onMouseMove = (e: MouseEvent) => {
    if (!isPanningRef.current) return;
    if (scale <= 1) return;
    setTranslate(clampTranslate(scale, { x: e.clientX - lastPanRef.current.x, y: e.clientY - lastPanRef.current.y }));
  };

  const onMouseUp = () => {
    isPanningRef.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case "Escape":
          onOpenChange(false);
          break;
        case "ArrowRight":
          setCurrentIndex((prev) => Math.min(prev + 1, imgUrls.length - 1));
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

  const handleCopyLocation = async () => {
    if (!readableDetails || !readableDetails.location || readableDetails.location === "暂无") return;
    try {
      await navigator.clipboard.writeText(readableDetails.location);
      setLocationCopied(true);
      window.setTimeout(() => setLocationCopied(false), 1500);
    } catch {
      setLocationCopied(false);
    }
  };

  // Return early if no images provided
  if (!imgUrls.length) return null;

  // Ensure currentIndex is within bounds
  const safeIndex = Math.max(0, Math.min(currentIndex, imgUrls.length - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[100vw] !h-[100dvh] !max-w-[100vw] !max-h-[100dvh] p-0 border-0 shadow-none bg-transparent [&>button]:hidden"
        aria-describedby="image-preview-description"
      >
        {/* Close button */}
        <div className="fixed top-4 right-4 z-50">
          <Button
            onClick={handleClose}
            variant="secondary"
            size="icon"
            className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm"
            aria-label="关闭图片预览"
          >
            <X className="h-4 w-4 text-popover-foreground" />
          </Button>
        </div>

        {/* Details button */}
        <div className="fixed top-4 left-4 z-50">
          <Button
            onClick={() => setDetailsOpen((prev) => !prev)}
            variant="secondary"
            size="sm"
            className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm text-popover-foreground"
            aria-label="切换照片详情"
          >
            <InfoIcon className="h-4 w-4 mr-1" />
            照片详情
          </Button>
        </div>

        {/* Reset transform button - fixed bottom center, match close button style and theme */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-popover/20 hover:bg-popover/30 border-border/20 backdrop-blur-sm text-popover-foreground"
            aria-label="恢复原始比例"
            onClick={() => {
              setScale(1);
              setTranslate({ x: 0, y: 0 });
              initialPinchDistanceRef.current = null;
              initialScaleRef.current = 1;
            }}
          >
            恢复原始比例
          </Button>
        </div>

        {detailsOpen && (
          <div className="fixed top-16 left-4 z-50 w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-9rem)] overflow-auto rounded-lg border border-border/40 bg-popover/90 text-popover-foreground backdrop-blur-md shadow-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-popover/95">
              <span className="text-sm font-medium">照片详细数据</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setDetailsOpen(false)} aria-label="关闭照片详情">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-3 py-2 text-xs space-y-3">
              {detailsLoading && <p className="text-muted-foreground">正在读取图片数据...</p>}
              {!detailsLoading && detailsError && <p className="text-destructive break-all">{detailsError}</p>}
              {!detailsLoading && !detailsError && !readableDetails && <p className="text-muted-foreground">未读取到可展示的数据</p>}

              {!detailsLoading && !detailsError && readableDetails && (
                <div className="space-y-2 text-sm">
                  <p className="break-all">
                    <span className="text-muted-foreground">拍摄时间：</span>
                    {readableDetails.shotTime}
                  </p>
                  <p className="break-all">
                    <span className="text-muted-foreground">文件信息：</span>
                    {readableDetails.fileInfo}
                  </p>
                  <p className="break-all">
                    <span className="text-muted-foreground">拍摄参数：</span>
                    {readableDetails.shootingParams}
                  </p>
                  <p className="break-all">
                    <span className="text-muted-foreground">文件路径：</span>
                    {readableDetails.filePath}
                  </p>
                  <p className="break-all flex items-center gap-2">
                    <span>
                      <span className="text-muted-foreground">拍摄地点：</span>
                      {readableDetails.location}
                    </span>
                    {readableDetails.location !== "暂无" && (
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={handleCopyLocation}>
                        {locationCopied ? "已复制" : "复制"}
                      </Button>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image container */}
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center px-4 sm:px-8 overflow-hidden touch-none"
          style={{
            paddingTop: "4.5rem",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 6.5rem)",
          }}
          onClick={handleBackdropClick}
        >
          <div
            ref={frameRef}
            className="relative w-full h-full max-w-[1200px] max-h-full border border-transparent bg-background/10 rounded-lg overflow-hidden"
            style={{
              touchAction: "none",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
            onWheel={(e) => {
              e.preventDefault();
              const delta = -e.deltaY * 0.0015;
              const newScale = Math.max(1, Math.min(MAX_SCALE, scale * (1 + delta)));
              setScale(newScale);
              setTranslate((prev) => clampTranslate(newScale, prev));
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              isPanningRef.current = true;
              lastPanRef.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
              (e.target as Element).ownerDocument?.addEventListener("mousemove", onMouseMove);
              (e.target as Element).ownerDocument?.addEventListener("mouseup", onMouseUp);
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDistanceRef.current = Math.hypot(dx, dy);
                initialScaleRef.current = scale;
              } else if (e.touches.length === 1) {
                isPanningRef.current = true;
                lastPanRef.current = { x: e.touches[0].clientX - translate.x, y: e.touches[0].clientY - translate.y };
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && initialPinchDistanceRef.current) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const ratio = dist / initialPinchDistanceRef.current;
                const newScale = Math.max(1, Math.min(MAX_SCALE, initialScaleRef.current * ratio));
                setScale(newScale);
                setTranslate((prev) => clampTranslate(newScale, prev));
                e.preventDefault();
              } else if (e.touches.length === 1 && isPanningRef.current) {
                const t = e.touches[0];
                setTranslate(
                  clampTranslate(scale, {
                    x: t.clientX - lastPanRef.current.x,
                    y: t.clientY - lastPanRef.current.y,
                  }),
                );
                e.preventDefault();
              }
            }}
            onTouchEnd={(e) => {
              if (e.touches.length < 2) {
                initialPinchDistanceRef.current = null;
                initialScaleRef.current = scale;
              }
              if (e.touches.length === 0) {
                isPanningRef.current = false;
              }
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: "transform 0s",
                transformOrigin: "center center",
              }}
            >
              <img
                ref={imgRef}
                src={imgUrls[safeIndex]}
                alt={`Preview image ${safeIndex + 1} of ${imgUrls.length}`}
                className="block w-full h-full object-contain select-none"
                draggable={false}
                loading="eager"
                decoding="async"
                onLoad={() => {
                  setTranslate((prev) => clampTranslate(scale, prev));
                }}
              />
            </div>
          </div>
        </div>

        {/* Screen reader description */}
        <div id="image-preview-description" className="sr-only">
          图片预览对话框。按 Escape 关闭，或点击图片外区域关闭。
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewImageDialog;

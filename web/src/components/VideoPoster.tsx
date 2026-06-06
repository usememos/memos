import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPosterProps {
  sourceUrl: string;
  alt: string;
  className?: string;
  posterUrl?: string;
}

const MAX_POSTER_DIMENSION = 960;

const getFrameSourceUrl = (sourceUrl: string): string => {
  if (!sourceUrl || sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:") || sourceUrl.includes("#")) {
    return sourceUrl;
  }

  return `${sourceUrl}#t=0.001`;
};

const getCanvasSize = (width: number, height: number) => {
  const scale = Math.min(1, MAX_POSTER_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const VideoPoster = ({ sourceUrl, alt, className, posterUrl }: VideoPosterProps) => {
  const usablePosterUrl = posterUrl && posterUrl !== sourceUrl ? posterUrl : undefined;
  const [capturedPosterUrl, setCapturedPosterUrl] = useState<string>();
  const frameSourceUrl = useMemo(() => getFrameSourceUrl(sourceUrl), [sourceUrl]);
  const posterImageUrl = usablePosterUrl ?? capturedPosterUrl;

  useEffect(() => {
    setCapturedPosterUrl(undefined);
  }, [sourceUrl, usablePosterUrl]);

  const captureFrame = useCallback(
    (video: HTMLVideoElement) => {
      if (usablePosterUrl || capturedPosterUrl || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }

      try {
        const { width, height } = getCanvasSize(video.videoWidth, video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        context.drawImage(video, 0, 0, width, height);
        setCapturedPosterUrl(canvas.toDataURL("image/jpeg", 0.86));
      } catch {
        // Cross-origin or codec-specific failures should keep the video fallback visible.
      }
    },
    [capturedPosterUrl, usablePosterUrl],
  );

  if (posterImageUrl) {
    return <img src={posterImageUrl} alt={alt} className={className} loading="lazy" decoding="async" />;
  }

  return (
    <video
      data-testid="video-poster-fallback"
      src={frameSourceUrl}
      className={cn("pointer-events-none", className)}
      muted
      playsInline
      preload="auto"
      onLoadedData={(event) => captureFrame(event.currentTarget)}
    />
  );
};

export default VideoPoster;

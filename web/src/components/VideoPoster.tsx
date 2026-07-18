import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPosterProps {
  sourceUrl: string;
  alt: string;
  className?: string;
  posterUrl?: string;
}

const MAX_POSTER_DIMENSION = 960;
const POSTER_LOAD_MARGIN = "200px 0px";

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
  const placeholderRef = useRef<HTMLDivElement>(null);
  const usablePosterUrl = posterUrl && posterUrl !== sourceUrl ? posterUrl : undefined;
  const [capturedPoster, setCapturedPoster] = useState<{ sourceUrl: string; url: string }>();
  const [nearViewport, setNearViewport] = useState(false);
  const frameSourceUrl = useMemo(() => getFrameSourceUrl(sourceUrl), [sourceUrl]);
  const capturedPosterUrl = capturedPoster?.sourceUrl === sourceUrl ? capturedPoster.url : undefined;
  const posterImageUrl = usablePosterUrl ?? capturedPosterUrl;

  useEffect(() => {
    if (posterImageUrl || nearViewport) {
      return;
    }

    const placeholder = placeholderRef.current;
    if (!placeholder) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: POSTER_LOAD_MARGIN },
    );

    observer.observe(placeholder);
    return () => observer.disconnect();
  }, [posterImageUrl, nearViewport]);

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
        setCapturedPoster({ sourceUrl, url: canvas.toDataURL("image/jpeg", 0.86) });
      } catch {
        // Cross-origin or codec-specific failures should keep the video fallback visible.
      }
    },
    [capturedPosterUrl, sourceUrl, usablePosterUrl],
  );

  if (posterImageUrl) {
    return <img src={posterImageUrl} alt={alt} className={className} loading="lazy" decoding="async" />;
  }

  if (!nearViewport) {
    return <div ref={placeholderRef} data-testid="video-poster-placeholder" role="img" aria-label={alt} className={className} />;
  }

  return (
    <video
      data-testid="video-poster-fallback"
      src={frameSourceUrl}
      className={cn("pointer-events-none", className)}
      role="img"
      aria-label={alt}
      muted
      playsInline
      preload="auto"
      onLoadedData={(event) => captureFrame(event.currentTarget)}
    />
  );
};

export default VideoPoster;

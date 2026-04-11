import { useEffect, useState } from "react";
import MotionPhotoPlayer from "@/components/MotionPhotoPlayer";
import { cn } from "@/lib/utils";

interface MotionPhotoPreviewProps {
  posterUrl: string;
  motionUrl: string;
  alt: string;
  presentationTimestampUs?: bigint;
  containerClassName?: string;
  mediaClassName?: string;
  posterClassName?: string;
  videoClassName?: string;
  badgeClassName?: string;
  loop?: boolean;
}

const MotionPhotoPreview = ({
  posterUrl,
  motionUrl,
  alt,
  presentationTimestampUs,
  containerClassName,
  mediaClassName,
  posterClassName,
  videoClassName,
  badgeClassName,
  loop = false,
}: MotionPhotoPreviewProps) => {
  const [motionActive, setMotionActive] = useState(false);

  useEffect(() => {
    setMotionActive(false);
  }, [motionUrl, posterUrl]);

  return (
    <div className={cn("relative max-w-full max-h-full", containerClassName)}>
      <MotionPhotoPlayer
        posterUrl={posterUrl}
        motionUrl={motionUrl}
        alt={alt}
        presentationTimestampUs={presentationTimestampUs}
        active={motionActive}
        loop={loop}
        containerClassName={cn("max-w-full max-h-full", containerClassName)}
        mediaClassName={mediaClassName}
        posterClassName={posterClassName}
        videoClassName={videoClassName}
      />
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "absolute select-none rounded-full border border-border/45 bg-background/65 px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground backdrop-blur-sm transition-colors hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          badgeClassName,
        )}
        onMouseEnter={() => setMotionActive(true)}
        onMouseLeave={() => setMotionActive(false)}
        onFocus={() => setMotionActive(true)}
        onBlur={() => setMotionActive(false)}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (event.pointerType !== "mouse") {
            setMotionActive(true);
          }
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (event.pointerType !== "mouse") {
            setMotionActive(false);
          }
        }}
        onPointerCancel={() => setMotionActive(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMotionActive((prev) => !prev);
          }
        }}
        aria-label="Hover or press to play live photo"
      >
        LIVE
      </div>
    </div>
  );
};

export default MotionPhotoPreview;

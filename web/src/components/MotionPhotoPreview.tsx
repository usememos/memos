import { useEffect, useState } from "react";
import MotionPhotoPlayer from "@/components/MotionPhotoPlayer";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

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
  const t = useTranslate();
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
          "absolute select-none rounded-full border border-mu-line/45 bg-mu-canvas/65 px-2.5 py-1 mu-label-sm uppercase tracking-wide text-mu-text backdrop-blur-sm transition-colors hover:bg-mu-canvas/80 mu-focus focus-visible:border-mu-focus",
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
        aria-label={t("attachment-preview.play-live-photo")}
      >
        {t("attachment-library.labels.live")}
      </div>
    </div>
  );
};

export default MotionPhotoPreview;

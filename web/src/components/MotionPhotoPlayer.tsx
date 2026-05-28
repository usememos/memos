import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MotionPhotoPlayerProps {
  posterUrl: string;
  motionUrl: string;
  alt: string;
  presentationTimestampUs?: bigint;
  containerClassName?: string;
  mediaClassName?: string;
  posterClassName?: string;
  videoClassName?: string;
  active?: boolean;
  loop?: boolean;
}

const MotionPhotoPlayer = ({
  posterUrl,
  motionUrl,
  alt,
  presentationTimestampUs,
  containerClassName,
  mediaClassName,
  posterClassName,
  videoClassName,
  active,
  loop = false,
}: MotionPhotoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const resetPlaybackPosition = useCallback(
    (video: HTMLVideoElement) => {
      const startTime = presentationTimestampUs && presentationTimestampUs > 0n ? Number(presentationTimestampUs) / 1_000_000 : 0;
      video.currentTime = startTime;
    },
    [presentationTimestampUs],
  );

  const stopPlayback = useCallback(
    (resetPosition = true) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      video.pause();
      if (resetPosition && video.readyState >= 1) {
        resetPlaybackPosition(video);
      }
      setIsPlaying(false);
    },
    [resetPlaybackPosition],
  );

  const startPlayback = useCallback(
    async (loop: boolean) => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      video.loop = loop;
      if (video.readyState >= 1) {
        resetPlaybackPosition(video);
      }

      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    },
    [resetPlaybackPosition],
  );

  useEffect(() => stopPlayback, [stopPlayback]);

  useEffect(() => {
    if (!active) {
      stopPlayback();
      return;
    }

    void startPlayback(loop);
  }, [active, loop, startPlayback, stopPlayback]);

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      <img
        src={posterUrl}
        alt={alt}
        className={cn("block max-h-full max-w-full select-none object-cover", mediaClassName, posterClassName)}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      <video
        ref={videoRef}
        src={motionUrl}
        poster={posterUrl}
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
          isPlaying ? "opacity-100" : "opacity-0",
          mediaClassName,
          videoClassName,
        )}
        muted
        playsInline
        preload="metadata"
        disableRemotePlayback
        onLoadedMetadata={(event) => resetPlaybackPosition(event.currentTarget)}
        onEnded={() => stopPlayback()}
      />
    </div>
  );
};

export default MotionPhotoPlayer;

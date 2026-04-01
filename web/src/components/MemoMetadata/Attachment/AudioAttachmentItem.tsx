import { FileAudioIcon, PauseIcon, PlayIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { formatAudioTime, getAttachmentMetadata } from "./attachmentViewHelpers";

const AUDIO_PLAYBACK_RATES = [1, 1.5, 2] as const;

interface AudioProgressBarProps {
  filename: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  onSeek: (value: string) => void;
}

const AudioProgressBar = ({ filename, currentTime, duration, progressPercent, onSeek }: AudioProgressBarProps) => (
  <div className="mt-2 flex items-center gap-2.5">
    <div className="relative flex h-4 min-w-0 flex-1 items-center">
      <div className="absolute inset-x-0 h-1 rounded-full bg-muted/75" />
      <div className="absolute left-0 h-1 rounded-full bg-foreground/20" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(e.target.value)}
        aria-label={`Seek ${filename}`}
        className="relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-default
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-transparent
          [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:size-2 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border/50
          [&::-webkit-slider-thumb]:bg-background/95
          [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
          [&::-moz-range-thumb]:size-2 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border
          [&::-moz-range-thumb]:border-border/50 [&::-moz-range-thumb]:bg-background/95"
        disabled={duration === 0}
      />
    </div>
    <div className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
      {formatAudioTime(currentTime)} / {duration > 0 ? formatAudioTime(duration) : "--:--"}
    </div>
  </div>
);

interface AudioAttachmentItemProps {
  attachment?: Attachment;
  filename?: string;
  displayName?: string;
  sourceUrl?: string;
  mimeType?: string;
  size?: number;
  actionSlot?: ReactNode;
}

const AudioAttachmentItem = ({ attachment, filename, displayName, sourceUrl, mimeType, size, actionSlot }: AudioAttachmentItemProps) => {
  const resolvedFilename = attachment?.filename ?? filename ?? "audio";
  const resolvedDisplayName = displayName ?? resolvedFilename;
  const resolvedSourceUrl = attachment ? getAttachmentUrl(attachment) : (sourceUrl ?? "");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof AUDIO_PLAYBACK_RATES)[number]>(1);
  const { fileTypeLabel, fileSizeLabel } = attachment
    ? getAttachmentMetadata(attachment)
    : {
        fileTypeLabel: getFileTypeLabel(mimeType ?? ""),
        fileSizeLabel: size ? formatFileSize(size) : undefined,
      };
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const handleSeek = (value: string) => {
    const audio = audioRef.current;
    const nextTime = Number(value);

    if (!audio || Number.isNaN(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlaybackRateChange = () => {
    const currentRateIndex = AUDIO_PLAYBACK_RATES.findIndex((rate) => rate === playbackRate);
    const nextRate = AUDIO_PLAYBACK_RATES[(currentRateIndex + 1) % AUDIO_PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);
  };

  const handleDuration = (value: number) => {
    setDuration(Number.isFinite(value) ? value : 0);
  };

  return (
    <div className="rounded-xl border border-border/35 bg-background/70 px-2.5 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/55 text-muted-foreground">
          <FileAudioIcon className="size-3.5" />
        </div>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-5 text-foreground" title={resolvedFilename}>
              {resolvedDisplayName}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-muted-foreground">
              <span>{fileTypeLabel}</span>
              {fileSizeLabel && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{fileSizeLabel}</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-0.5 flex shrink-0 items-center gap-1">
            {actionSlot}
            <button
              type="button"
              onClick={handlePlaybackRateChange}
              className="inline-flex h-6 items-center justify-center px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Playback speed ${playbackRate}x for ${resolvedDisplayName}`}
            >
              {playbackRate}x
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex size-6.5 items-center justify-center rounded-md border border-border/45 bg-background/85 text-foreground transition-colors hover:bg-muted/45"
              aria-label={isPlaying ? `Pause ${resolvedDisplayName}` : `Play ${resolvedDisplayName}`}
            >
              {isPlaying ? <PauseIcon className="size-3" /> : <PlayIcon className="size-3 translate-x-[0.5px]" />}
            </button>
          </div>
        </div>
      </div>

      <AudioProgressBar
        filename={resolvedFilename}
        currentTime={currentTime}
        duration={duration}
        progressPercent={progressPercent}
        onSeek={handleSeek}
      />

      <audio
        ref={audioRef}
        src={resolvedSourceUrl}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => handleDuration(e.currentTarget.duration)}
        onDurationChange={(e) => handleDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
};

export default AudioAttachmentItem;

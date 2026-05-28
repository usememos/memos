import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { formatAudioTime } from "./attachmentHelpers";

const AUDIO_PLAYBACK_RATES = [1, 1.5, 2] as const;
const UNKNOWN_DURATION_LABEL = "--:--";

const getDurationLabel = (duration: number): string => (duration > 0 ? formatAudioTime(duration) : UNKNOWN_DURATION_LABEL);

const getNextPlaybackRate = (currentRate: (typeof AUDIO_PLAYBACK_RATES)[number]): (typeof AUDIO_PLAYBACK_RATES)[number] => {
  const currentRateIndex = AUDIO_PLAYBACK_RATES.findIndex((rate) => rate === currentRate);
  return AUDIO_PLAYBACK_RATES[(currentRateIndex + 1) % AUDIO_PLAYBACK_RATES.length];
};

interface AudioProgressBarProps {
  filename: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  onSeek: (value: number) => void;
  className?: string;
}

const AudioProgressBar = ({ filename, currentTime, duration, progressPercent, onSeek, className }: AudioProgressBarProps) => (
  <div className={`flex items-center gap-2 ${className ?? ""}`}>
    <div className="relative flex h-3.5 min-w-0 flex-1 items-center">
      <div className="absolute inset-x-0 h-1 rounded-full bg-muted/75" />
      <div className="absolute left-0 h-1 rounded-full bg-foreground/20" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label={`Seek ${filename}`}
        className="relative z-10 h-3.5 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-default
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-transparent
          [&::-webkit-slider-thumb]:mt-[-2.5px] [&::-webkit-slider-thumb]:size-2 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border/50
          [&::-webkit-slider-thumb]:bg-background/95
          [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
          [&::-moz-range-thumb]:size-2 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border
          [&::-moz-range-thumb]:border-border/50 [&::-moz-range-thumb]:bg-background/95"
        disabled={duration === 0}
      />
    </div>
  </div>
);

interface AudioAttachmentItemProps {
  filename: string;
  sourceUrl: string;
  mimeType: string;
  size?: number;
  title?: string;
  compact?: boolean;
  className?: string;
}

const AudioAttachmentItem = ({ filename, sourceUrl, mimeType, size, title, compact = false, className }: AudioAttachmentItemProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof AUDIO_PLAYBACK_RATES)[number]>(1);
  const displayTitle = title ?? filename;
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentTimeLabel = formatAudioTime(currentTime);
  const durationLabel = getDurationLabel(duration);
  const timeLabel = `${currentTimeLabel} / ${durationLabel}`;

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

  const handleSeek = (nextTime: number) => {
    const audio = audioRef.current;

    if (!audio || Number.isNaN(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlaybackRateChange = () => {
    setPlaybackRate((currentRate) => getNextPlaybackRate(currentRate));
  };

  const handleDuration = (value: number) => {
    setDuration(Number.isFinite(value) ? value : 0);
  };

  return (
    <div className={cn("rounded-xl border border-border/40 bg-background/75", compact ? "px-3 py-2.5" : "px-2 py-1.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("min-w-0 flex flex-1", compact ? "flex-col gap-0.5" : "items-baseline gap-1")}>
          <div className="truncate text-sm font-medium leading-5 text-foreground" title={filename}>
            {displayTitle}
          </div>
          <div className="truncate text-[11px] leading-4 text-muted-foreground">
            {fileTypeLabel}
            {fileSizeLabel ? ` · ${fileSizeLabel}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md border border-border/45 bg-background/90 text-foreground transition-colors hover:bg-muted/45"
          aria-label={isPlaying ? `Pause ${displayTitle}` : `Play ${displayTitle}`}
        >
          {isPlaying ? <PauseIcon className="size-2.5" /> : <PlayIcon className="size-2.5 translate-x-[0.5px]" />}
        </button>
      </div>

      <div className={cn("mt-1", compact ? "space-y-1.5" : "flex items-center gap-1")}>
        <AudioProgressBar
          filename={filename}
          currentTime={currentTime}
          duration={duration}
          progressPercent={progressPercent}
          onSeek={handleSeek}
          className="min-w-0 flex-1"
        />

        <div className={cn("flex items-center", compact ? "justify-between gap-2" : "shrink-0 gap-1")}>
          <div className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeLabel}</div>

          <button
            type="button"
            onClick={handlePlaybackRateChange}
            className="inline-flex h-5 shrink-0 items-center justify-center rounded-md border border-transparent px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border/40 hover:text-foreground"
            aria-label={`Playback speed ${playbackRate}x for ${displayTitle}`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={sourceUrl}
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

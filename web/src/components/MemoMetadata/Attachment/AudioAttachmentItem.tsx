import { DownloadIcon, Maximize2Icon, PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import {
  METADATA_ROW_BOX_CLASSES,
  METADATA_ROW_HINT_CLASSES,
  METADATA_ROW_ICON_CLASSES,
  METADATA_ROW_LABEL_CLASSES,
  METADATA_ROW_SLOT_BUTTON_CLASSES,
  METADATA_ROW_TEXT_CLASSES,
  MetadataRowDetail,
} from "../MetadataSection";
import { formatAudioTime, toggleAudioPlayback } from "./attachmentHelpers";

const AUDIO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.5, 2] as const;
const UNKNOWN_DURATION_LABEL = "--:--";
const SKIP_SECONDS = 10;
const OPEN_PLAYER_CLASSES = cn(METADATA_ROW_LABEL_CLASSES, "cursor-pointer");
const DOWNLOAD_CLASSES = buttonVariants({ variant: "quiet", size: "icon" });

const getDurationLabel = (duration: number): string => (duration > 0 ? formatAudioTime(duration) : UNKNOWN_DURATION_LABEL);

const getNextPlaybackRate = (currentRate: (typeof AUDIO_PLAYBACK_RATES)[number]): (typeof AUDIO_PLAYBACK_RATES)[number] => {
  const currentRateIndex = AUDIO_PLAYBACK_RATES.findIndex((rate) => rate === currentRate);
  return AUDIO_PLAYBACK_RATES[(currentRateIndex + 1) % AUDIO_PLAYBACK_RATES.length];
};

interface AudioProgressBarProps {
  filename: string;
  currentTime: number;
  duration: number;
  onSeek: (value: number) => void;
}

const AudioProgressBar = ({ filename, currentTime, duration, onSeek }: AudioProgressBarProps) => {
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="relative flex h-4 w-full items-center">
      <div className="absolute inset-x-0 h-1 rounded-full bg-muted" />
      <div className="absolute start-0 h-1 rounded-full bg-primary/60" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label={`Seek ${filename}`}
        className="relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-default
          [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-transparent
          [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border
          [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-xs
          [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
          [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border
          [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-background"
        disabled={duration === 0}
      />
    </div>
  );
};

interface AudioAttachmentItemProps {
  filename: string;
  sourceUrl: string;
  mimeType: string;
  size?: number;
}

/**
 * An audio attachment is a metadata row like a document. The play control in the leading
 * slot starts and pauses playback in place; the name opens a small player with the
 * scrubber, skip, speed and download. The audio element lives here, not in the dialog, so
 * playback carries on when the dialog closes and the row's glyph always reflects it.
 */
const AudioAttachmentItem = ({ filename, sourceUrl, mimeType, size }: AudioAttachmentItemProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof AUDIO_PLAYBACK_RATES)[number]>(1);
  const [playerOpen, setPlayerOpen] = useState(false);
  // Only the open player reads the playhead, so the row does not re-render on every timeupdate while it plays.
  const [currentTime, setCurrentTime] = useState(0);
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;
  const PlaybackIcon = isPlaying ? PauseIcon : PlayIcon;
  const playbackLabel = isPlaying ? `Pause ${filename}` : `Play ${filename}`;

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

    await toggleAudioPlayback(audio, sourceUrl, () => setIsPlaying(false));
  };

  const handleSeek = (nextTime: number) => {
    const audio = audioRef.current;

    if (!audio || Number.isNaN(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const limit = duration > 0 ? duration : Number.POSITIVE_INFINITY;
    handleSeek(Math.min(Math.max(audio.currentTime + seconds, 0), limit));
  };

  const handlePlayerOpenChange = (open: boolean) => {
    if (open) setCurrentTime(audioRef.current?.currentTime ?? 0);
    setPlayerOpen(open);
  };

  const handlePlaybackRateChange = () => {
    setPlaybackRate((currentRate) => getNextPlaybackRate(currentRate));
  };

  const handleDuration = (value: number) => {
    setDuration(Number.isFinite(value) ? value : 0);
  };

  return (
    <>
      <div className={METADATA_ROW_BOX_CLASSES}>
        <button
          type="button"
          className={METADATA_ROW_SLOT_BUTTON_CLASSES}
          onClick={togglePlayback}
          aria-pressed={isPlaying}
          aria-label={playbackLabel}
        >
          <PlaybackIcon className={METADATA_ROW_ICON_CLASSES} strokeWidth={1.8} />
        </button>
        {/* The name opens the player; an open glyph takes the detail rail's place once the row is engaged. */}
        <button type="button" className={OPEN_PLAYER_CLASSES} onClick={() => handlePlayerOpenChange(true)} title={filename}>
          <span className={METADATA_ROW_TEXT_CLASSES}>{filename}</span>
          <MetadataRowDetail parts={[duration > 0 ? getDurationLabel(duration) : undefined, fileTypeLabel, fileSizeLabel]} />
          <Maximize2Icon aria-hidden="true" className={METADATA_ROW_HINT_CLASSES} strokeWidth={1.8} />
        </button>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        className="hidden"
        onLoadedMetadata={(e) => handleDuration(e.currentTarget.duration)}
        onDurationChange={(e) => handleDuration(e.currentTarget.duration)}
        onTimeUpdate={playerOpen ? (e) => setCurrentTime(e.currentTarget.currentTime) : undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <Dialog open={playerOpen} onOpenChange={handlePlayerOpenChange}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{filename}</DialogTitle>
            <DialogDescription>{[fileTypeLabel, fileSizeLabel].filter(Boolean).join(" · ")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1">
            <AudioProgressBar filename={filename} currentTime={currentTime} duration={duration} onSeek={handleSeek} />
            <div className="flex items-center justify-between text-2xs tabular-nums text-muted-foreground/60">
              <span>{formatAudioTime(currentTime)}</span>
              <span>{getDurationLabel(duration)}</span>
            </div>
          </div>

          {/* One 32px rail: download at the start, transport in the middle, speed at the end. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex justify-start">
              <a href={sourceUrl} download className={DOWNLOAD_CLASSES} aria-label={`Download ${filename}`}>
                <DownloadIcon className="size-4" strokeWidth={1.8} />
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="quiet" size="icon" onClick={() => skip(-SKIP_SECONDS)} aria-label={`Back ${SKIP_SECONDS} seconds`}>
                <RotateCcwIcon className="size-4" strokeWidth={1.8} />
              </Button>
              <Button size="icon" onClick={togglePlayback} aria-label={playbackLabel}>
                <PlaybackIcon className="size-4" strokeWidth={2} />
              </Button>
              <Button variant="quiet" size="icon" onClick={() => skip(SKIP_SECONDS)} aria-label={`Forward ${SKIP_SECONDS} seconds`}>
                <RotateCwIcon className="size-4" strokeWidth={1.8} />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="quiet" size="sm" onClick={handlePlaybackRateChange} aria-label={`Playback speed ${playbackRate}x`}>
                {playbackRate}x
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AudioAttachmentItem;

import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  src: string;
  className?: string;
}

const AudioPlayer = ({ src, className = "" }: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration((prev) => (prev === 0 ? audio.duration : prev));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadedData = () => {
      // For files without proper duration in metadata,
      // try to get it after some data is loaded
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  useEffect(() => {
    const handlePlayAudio = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== audioRef.current && isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };

    document.addEventListener("play-audio", handlePlayAudio);
    return () => {
      document.removeEventListener("play-audio", handlePlayAudio);
    };
  }, [isPlaying]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        // Stop other audio players
        const event = new CustomEvent("play-audio", { detail: audio });
        document.dispatchEvent(event);

        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to play audio:", error);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    if (!isFinite(time) || isNaN(time)) return "0:00";

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlayPause}
        disabled={isLoading}
        className="shrink-0 p-0 h-5 w-5 hover:bg-transparent text-muted-foreground hover:text-foreground"
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
      >
        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
      </Button>
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleSeek}
        disabled={isLoading || !duration}
        className="w-full min-w-[128px] h-1 rounded-md bg-secondary cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full"
        aria-label="Seek audio position"
      />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioPlayer;

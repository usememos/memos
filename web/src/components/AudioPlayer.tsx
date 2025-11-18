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

        const handleLoadedMetadata = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
            setIsLoading(false);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (duration === 0 && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
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
    }, []);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
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

            <div className="flex flex-row items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
                <span className="font-mono text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                disabled={isLoading}
                className="shrink-0"
            >
                {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </Button>

            <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                disabled={isLoading || !duration}
                className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
            />
        </div>
    );
};

export default AudioPlayer;

import type { FC } from "react";
import { cn } from "@/lib/utils";

/** Max half-height of each bar (px); bars are centered vertically. */
const MAX_BAR_PX = 11;
const MIN_BAR_PX = 2;

type VoiceWaveformProps = {
  levels: number[];
  className?: string;
};

/**
 * Tight-packed vertical bars (rounded caps): fixed bar width + minimal gap — no `flex-1` columns
 * so bars stay visually dense like compact voice-memo waveforms.
 */
export const VoiceWaveform: FC<VoiceWaveformProps> = ({ levels, className }) => {
  return (
    <div className={cn("flex h-5 w-max max-w-full shrink-0 items-center gap-px", className)} aria-hidden>
      {levels.map((level, i) => {
        const h = Math.max(MIN_BAR_PX, level * MAX_BAR_PX);
        const centerDistance = Math.abs(i - (levels.length - 1) / 2) / (levels.length / 2);
        const opacity = 0.35 + (1 - centerDistance) * 0.35;
        return (
          <span
            key={`bar-${i}`}
            className="w-[2px] shrink-0 rounded-full bg-muted-foreground transition-[height,opacity] duration-75 ease-out"
            style={{ height: `${h}px`, opacity }}
          />
        );
      })}
    </div>
  );
};

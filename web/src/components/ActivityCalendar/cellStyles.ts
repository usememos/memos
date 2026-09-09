import { cn } from "@/lib/utils";
import type { CalendarDayCell } from "./types";

/**
 * The square chip inside a cell carries every visual. `max-w-[30px]` caps it so a wider
 * container spends its surplus on hit area rather than row height; the 224px rail's ~25px
 * columns sit below the cap and are unaffected.
 */
const CHIP_BASE =
  "relative flex aspect-square w-full max-w-[30px] items-center justify-center rounded-md text-center text-xs font-normal leading-none tracking-[-0.01em] tabular-nums transition-[background-color,color,filter,box-shadow] duration-150 ease-out";

/** Hover reads off the cell (`group/day`), not the chip, so the whole column responds to the pointer. */
const INTERACTIVE_CHIP =
  "group-hover/day:brightness-[0.97] group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring/40 group-focus-visible/day:ring-inset";

const OUTSIDE_MONTH_CHIP = "bg-transparent text-muted-foreground/25";
const EMPTY_CHIP = "bg-transparent text-foreground/75 group-hover/day:bg-muted/40";
/** A picked day is a checked filter like a view or tag row: it takes the accent, not a ring. */
const SELECTED_CHIP = "z-10 bg-primary font-medium text-primary-foreground";

/** Activity tints, ordered from the fraction of `maxCount` a day must exceed to earn them. */
const INTENSITY_TINTS: ReadonlyArray<readonly [threshold: number, className: string]> = [
  [0.75, "bg-blue-400/60 text-foreground/85"],
  [0.5, "bg-blue-400/45 text-foreground/80"],
  [0.25, "bg-blue-400/30 text-foreground/80"],
  [0, "bg-blue-400/18 text-foreground/75"],
];

const getFillClass = (day: CalendarDayCell, maxCount: number): string => {
  if (!day.isCurrentMonth) return OUTSIDE_MONTH_CHIP;
  // Selected owns the fill outright: layering the empty-cell hover tint on top would swap
  // the accent out on hover and leave primary-foreground text on a muted chip.
  if (day.isSelected) return SELECTED_CHIP;
  if (day.count === 0) return EMPTY_CHIP;

  const ratio = day.count / maxCount;
  const tint = INTENSITY_TINTS.find(([threshold]) => ratio > threshold);
  return tint?.[1] ?? EMPTY_CHIP;
};

export const getChipClassName = (day: CalendarDayCell, maxCount: number, isInteractive: boolean): string =>
  cn(CHIP_BASE, getFillClass(day, maxCount), isInteractive && day.isCurrentMonth && INTERACTIVE_CHIP);

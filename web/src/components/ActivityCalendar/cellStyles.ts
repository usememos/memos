import { cn } from "@/lib/utils";
import type { CalendarDayCell } from "./types";
import { type ActivityLevel, getActivityLevel } from "./utils";

/**
 * The square chip inside a cell carries every visual. The grid's columns are 28px (see
 * CALENDAR_GRID_CLASSES) and the cell takes the pointer across all of it; the chip is a 24px
 * square inside (`max-w-6`), so the fills of neighbouring days never run together. The
 * transparent border reserves the line that marks today.
 */
const CHIP_BASE =
  "relative flex aspect-square w-full max-w-6 items-center justify-center rounded-mu-md border border-transparent text-center mu-caption tabular-nums transition-[background-color,border-color,color,filter] duration-150 ease-out";

/** Hover reads off the cell (`group/day`), not the chip, so the whole column responds to the pointer. */
const INTERACTIVE_CHIP =
  "group-hover/day:brightness-[0.97] group-focus-visible/day:outline-2 group-focus-visible/day:outline-solid group-focus-visible/day:-outline-offset-2 group-focus-visible/day:outline-mu-focus";

const OUTSIDE_MONTH_CHIP = "bg-transparent text-mu-text-secondary/25";
/** A day without memos recedes to secondary ink, so the days that have them lead. */
const EMPTY_CHIP = "bg-transparent text-mu-text-secondary group-hover/day:bg-mu-well/40";
/** A picked day is a checked filter like a view or tag row: it takes the accent, not a ring. */
const SELECTED_CHIP = "z-10 bg-mu-primary text-mu-on-primary";
/** Today is outlined, quieter than a picked day's fill; a picked today shows the fill alone. */
const TODAY_CHIP = "border-mu-text/40 text-mu-text";

/**
 * Primary-tinted activity levels; the small chip can carry a stronger wash than a full day cell.
 * The ramp stops at 30% so the busiest day never passes for a picked one, and every step keeps
 * text ink: a day with memos is told from an empty one by its ink as well as its fill.
 */
const INTENSITY_TINTS: Record<Exclude<ActivityLevel, 0>, string> = {
  1: "bg-mu-primary/8 text-mu-text",
  2: "bg-mu-primary/14 text-mu-text",
  3: "bg-mu-primary/21 text-mu-text",
  4: "bg-mu-primary/30 text-mu-text",
};

/**
 * The same ladder for a full calendar day cell, with its hover step: far lighter than the chip
 * because excerpts and photos sit on top. It stops at 16%, the strongest wash on which the
 * secondary excerpt text keeps 4.5:1 in both themes. Kept beside the chip's so the two cannot drift.
 */
export const DAY_CELL_FILLS: Record<ActivityLevel, string> = {
  0: "bg-mu-surface hover:bg-mu-hover",
  1: "bg-mu-primary/7 hover:bg-mu-primary/10",
  2: "bg-mu-primary/10 hover:bg-mu-primary/13",
  3: "bg-mu-primary/13 hover:bg-mu-primary/16",
  4: "bg-mu-primary/16 hover:bg-mu-primary/20",
};

const getFillClass = (day: CalendarDayCell, maxCount: number): string => {
  if (!day.isCurrentMonth) return OUTSIDE_MONTH_CHIP;
  // Selected owns the fill outright: layering the empty-cell hover tint on top would swap
  // the accent out on hover and leave primary-foreground text on a muted chip.
  if (day.isSelected) return SELECTED_CHIP;
  const level = getActivityLevel(day.count, maxCount);
  return level === 0 ? EMPTY_CHIP : INTENSITY_TINTS[level];
};

export const getChipClassName = (day: CalendarDayCell, maxCount: number, isInteractive: boolean): string =>
  cn(
    CHIP_BASE,
    getFillClass(day, maxCount),
    day.isCurrentMonth && day.isToday && !day.isSelected && TODAY_CHIP,
    isInteractive && day.isCurrentMonth && INTERACTIVE_CHIP,
  );

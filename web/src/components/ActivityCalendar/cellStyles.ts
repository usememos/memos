import { cn } from "@/lib/utils";
import type { CalendarDayCell } from "./types";
import { type ActivityLevel, getActivityLevel } from "./utils";

/**
 * The square chip inside a cell carries every visual. The grid's columns are 28px (see
 * CALENDAR_GRID_CLASSES), so the chip is a 28px square; `max-w-7` keeps it there should a
 * wider container ever hand the cell more.
 */
const CHIP_BASE =
  "relative flex aspect-square w-full max-w-7 items-center justify-center rounded-mu-md text-center mu-caption tabular-nums transition-[background-color,color,filter,box-shadow] duration-150 ease-out";

/** Hover reads off the cell (`group/day`), not the chip, so the whole column responds to the pointer. */
const INTERACTIVE_CHIP =
  "group-hover/day:brightness-[0.97] group-focus-visible/day:outline-2 group-focus-visible/day:outline-solid group-focus-visible/day:-outline-offset-2 group-focus-visible/day:outline-mu-focus";

const OUTSIDE_MONTH_CHIP = "bg-transparent text-mu-ink-muted/25";
const EMPTY_CHIP = "bg-transparent text-mu-ink/75 group-hover/day:bg-mu-well/40";
/** A picked day is a checked filter like a view or tag row: it takes the accent, not a ring. */
const SELECTED_CHIP = "z-10 bg-mu-primary text-mu-on-primary";

/** Primary-tinted activity levels; the small chip can carry a stronger wash than a full day cell. */
const INTENSITY_TINTS: Record<Exclude<ActivityLevel, 0>, string> = {
  1: "bg-mu-primary/12 text-mu-ink/75",
  2: "bg-mu-primary/22 text-mu-ink/80",
  3: "bg-mu-primary/34 text-mu-ink/80",
  4: "bg-mu-primary/48 text-mu-ink/85",
};

/**
 * The same ladder for a full calendar day cell, with its hover step: lighter than the chip
 * because excerpts and photos sit on top. Kept beside the chip's so the two cannot drift.
 */
export const DAY_CELL_FILLS: Record<ActivityLevel, string> = {
  0: "bg-mu-surface hover:bg-mu-hover",
  1: "bg-mu-primary/8 hover:bg-mu-primary/12",
  2: "bg-mu-primary/16 hover:bg-mu-primary/20",
  3: "bg-mu-primary/26 hover:bg-mu-primary/30",
  4: "bg-mu-primary/38 hover:bg-mu-primary/42",
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
  cn(CHIP_BASE, getFillClass(day, maxCount), isInteractive && day.isCurrentMonth && INTERACTIVE_CHIP);

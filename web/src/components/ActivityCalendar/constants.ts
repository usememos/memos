export const DAYS_IN_WEEK = 7;
export const MONTHS_IN_YEAR = 12;
export const MIN_COUNT = 1;

export const MIN_YEAR = 1970;
export const getMaxYear = () => new Date().getFullYear() + 1;

export const INTENSITY_THRESHOLDS = {
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
  MINIMAL: 0,
} as const;

export const CELL_STYLES = {
  HIGH: "bg-blue-400/60 text-foreground/85",
  MEDIUM: "bg-blue-400/45 text-foreground/80",
  LOW: "bg-blue-400/30 text-foreground/80",
  MINIMAL: "bg-blue-400/18 text-foreground/75",
  // Hover reads off the cell, not the chip, so the whole column responds to the pointer.
  EMPTY: "bg-transparent text-foreground/75 group-hover/day:bg-muted/40",
} as const;

/**
 * `maxSize` caps the square chip that carries a day's fill, so a chip measures
 * `min(column, maxSize)`. Narrow containers are untouched — the 224px rail's ~25px columns
 * stay below the cap — while wider ones spend the surplus on hit area rather than height,
 * which is what stops a widened sidebar from doubling the calendar's height.
 */
export const SMALL_CELL_SIZE = {
  font: "text-[10px] font-normal leading-none tracking-[-0.01em] tabular-nums",
  maxSize: "max-w-[24px]",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs font-normal leading-none tracking-[-0.01em] tabular-nums",
  maxSize: "max-w-[30px]",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

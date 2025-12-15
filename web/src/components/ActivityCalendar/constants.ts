export const DAYS_IN_WEEK = 7;
export const MONTHS_IN_YEAR = 12;
export const WEEKEND_DAYS = [0, 6] as const;
export const MIN_COUNT = 1;

export const INTENSITY_THRESHOLDS = {
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
  MINIMAL: 0,
} as const;

export const SMALL_CELL_SIZE = {
  font: "text-[10px]",
  dimensions: "max-w-6 max-h-6",
  borderRadius: "rounded-sm",
  gap: "gap-px",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs",
  borderRadius: "rounded",
  gap: "gap-0.5",
} as const;

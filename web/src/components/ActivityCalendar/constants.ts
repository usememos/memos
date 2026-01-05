export const DAYS_IN_WEEK = 7;
export const MONTHS_IN_YEAR = 12;
export const WEEKEND_DAYS = [0, 6] as const;
export const MIN_COUNT = 1;

export const MIN_YEAR = 2000;
export const getMaxYear = () => new Date().getFullYear() + 1;

export const INTENSITY_THRESHOLDS = {
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
  MINIMAL: 0,
} as const;

export const CELL_STYLES = {
  HIGH: "bg-primary text-primary-foreground shadow-sm",
  MEDIUM: "bg-primary/80 text-primary-foreground shadow-sm",
  LOW: "bg-primary/60 text-primary-foreground shadow-sm",
  MINIMAL: "bg-primary/40 text-foreground",
  EMPTY: "bg-secondary/30 text-muted-foreground hover:bg-secondary/50",
} as const;

export const SMALL_CELL_SIZE = {
  font: "text-xs",
  dimensions: "w-8 h-8 mx-auto",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs",
  borderRadius: "rounded-md",
  gap: "gap-1.5",
} as const;

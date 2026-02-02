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
  HIGH: "bg-primary text-primary-foreground shadow-sm border-transparent",
  MEDIUM: "bg-primary/85 text-primary-foreground shadow-sm border-transparent",
  LOW: "bg-primary/70 text-primary-foreground border-transparent",
  MINIMAL: "bg-primary/50 text-foreground border-transparent",
  EMPTY: "bg-muted/20 text-muted-foreground hover:bg-muted/30 border-border/10",
} as const;

export const SMALL_CELL_SIZE = {
  font: "text-[11px]",
  dimensions: "w-full h-full",
  borderRadius: "rounded-lg",
  gap: "gap-1.5",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs",
  borderRadius: "rounded-lg",
  gap: "gap-2",
} as const;

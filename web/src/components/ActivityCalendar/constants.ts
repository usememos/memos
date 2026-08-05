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
  EMPTY: "bg-transparent text-foreground/75 hover:bg-muted/40",
} as const;

export const SMALL_CELL_SIZE = {
  font: "text-[10px] font-normal leading-none tracking-[-0.01em] tabular-nums",
  dimensions: "w-full h-full",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs font-normal leading-none tracking-[-0.01em] tabular-nums",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

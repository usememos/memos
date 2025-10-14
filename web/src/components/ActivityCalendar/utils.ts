import type { CalendarDayCell } from "./types";

export const getCellIntensityClass = (day: CalendarDayCell, maxCount: number): string => {
  if (!day.isCurrentMonth || day.count === 0 || maxCount <= 0) {
    return "bg-transparent";
  }

  const ratio = day.count / maxCount;
  if (ratio > 0.75) return "bg-primary text-primary-foreground border-primary";
  if (ratio > 0.5) return "bg-primary/80 text-primary-foreground border-primary/90";
  if (ratio > 0.25) return "bg-primary/60 text-primary-foreground border-primary/70";
  return "bg-primary/40 text-primary";
};

import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { INTENSITY_THRESHOLDS, MIN_COUNT, MONTHS_IN_YEAR } from "./constants";
import type { CalendarDayCell } from "./types";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export const getCellIntensityClass = (day: CalendarDayCell, maxCount: number): string => {
  if (!day.isCurrentMonth || day.count === 0) {
    return "bg-transparent";
  }

  const ratio = day.count / maxCount;
  if (ratio > INTENSITY_THRESHOLDS.HIGH) return "bg-primary text-primary-foreground border-primary";
  if (ratio > INTENSITY_THRESHOLDS.MEDIUM) return "bg-primary/80 text-primary-foreground border-primary/90";
  if (ratio > INTENSITY_THRESHOLDS.LOW) return "bg-primary/60 text-primary-foreground border-primary/70";
  return "bg-primary/40 text-primary";
};

export const generateMonthsForYear = (year: number): string[] => {
  return Array.from({ length: MONTHS_IN_YEAR }, (_, i) => dayjs(`${year}-01-01`).add(i, "month").format("YYYY-MM"));
};

export const calculateYearMaxCount = (data: Record<string, number>): number => {
  let max = 0;
  for (const count of Object.values(data)) {
    max = Math.max(max, count);
  }
  return Math.max(max, MIN_COUNT);
};

export const getMonthLabel = (month: string): string => {
  return dayjs(month).format("MMM YYYY");
};

export const filterDataByYear = (data: Record<string, number>, year: number): Record<string, number> => {
  if (!data) return {};

  const filtered: Record<string, number> = {};
  const yearStart = dayjs(`${year}-01-01`);
  const yearEnd = dayjs(`${year}-12-31`);

  for (const [dateStr, count] of Object.entries(data)) {
    const date = dayjs(dateStr);
    if (date.isSameOrAfter(yearStart, "day") && date.isSameOrBefore(yearEnd, "day")) {
      filtered[dateStr] = count;
    }
  }

  return filtered;
};

export const hasActivityData = (data: Record<string, number>): boolean => {
  return Object.values(data).some((count) => count > 0);
};

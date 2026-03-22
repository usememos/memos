import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { useTranslate } from "@/utils/i18n";
import { CELL_STYLES, INTENSITY_THRESHOLDS, MIN_COUNT, MONTHS_IN_YEAR } from "./constants";
import type { CalendarDayCell } from "./types";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export type TranslateFunction = ReturnType<typeof useTranslate>;

export const getCellIntensityClass = (day: CalendarDayCell, maxCount: number): string => {
  if (!day.isCurrentMonth || day.count === 0) {
    return CELL_STYLES.EMPTY;
  }

  const ratio = day.count / maxCount;
  if (ratio > INTENSITY_THRESHOLDS.HIGH) return CELL_STYLES.HIGH;
  if (ratio > INTENSITY_THRESHOLDS.MEDIUM) return CELL_STYLES.MEDIUM;
  if (ratio > INTENSITY_THRESHOLDS.LOW) return CELL_STYLES.LOW;
  return CELL_STYLES.MINIMAL;
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
  return dayjs(month).format("MMM");
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

export const getTooltipText = (count: number, date: string, t: TranslateFunction): string => {
  if (count === 0) {
    return date;
  }

  return t("memo.count-memos-in-date", {
    count,
    memos: count === 1 ? t("common.memo") : t("common.memos"),
    date,
  }).toLowerCase();
};

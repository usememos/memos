import type { MemoTimeBasis } from "@/contexts/ViewContext";
import type { useTranslate } from "@/utils/i18n";
import type { CalendarData } from "./types";

export type TranslateFunction = ReturnType<typeof useTranslate>;

/** Largest daily count in the data, floored at 1 so intensity ratios never divide by zero. */
export const calculateMaxCount = (data: CalendarData): number => Math.max(1, ...Object.values(data));

/** 0 = no activity; 1–4 = the quarter of `maxCount` a day's count falls into, GitHub-heatmap style. */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

/** `maxCount` is at least 1, as `calculateMaxCount` guarantees. */
export const getActivityLevel = (count: number, maxCount: number): ActivityLevel => {
  if (count <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
};

export const getTooltipText = (count: number, date: string, t: TranslateFunction, timeBasis: MemoTimeBasis = "create_time"): string => {
  if (count === 0) {
    return date;
  }

  const key = timeBasis === "update_time" ? "memo.count-memos-updated-in-date" : "memo.count-memos-in-date";
  return t(key, {
    count,
    memos: count === 1 ? t("common.memo") : t("common.memos"),
    date,
  }).toLowerCase();
};

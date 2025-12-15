import dayjs from "dayjs";
import { useMemo } from "react";
import { useTranslate } from "@/utils/i18n";

export type TranslateFunction = ReturnType<typeof useTranslate>;

export const useWeekdayLabels = () => {
  const t = useTranslate();
  return useMemo(() => [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")], [t]);
};

export const useTodayDate = () => {
  return dayjs().format("YYYY-MM-DD");
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

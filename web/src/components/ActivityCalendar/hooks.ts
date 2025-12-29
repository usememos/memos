import dayjs from "dayjs";
import { useMemo } from "react";
import { useTranslate } from "@/utils/i18n";

export const useWeekdayLabels = () => {
  const t = useTranslate();
  return useMemo(() => [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")], [t]);
};

export const useTodayDate = () => {
  return dayjs().format("YYYY-MM-DD");
};

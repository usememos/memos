import dayjs from "dayjs";
import { useMemo } from "react";
import { useTranslate } from "@/utils/i18n";

export const useWeekdayLabels = () => {
  const t = useTranslate();
  return useMemo(
    () => [
      t("common.days.sun"),
      t("common.days.mon"),
      t("common.days.tue"),
      t("common.days.wed"),
      t("common.days.thu"),
      t("common.days.fri"),
      t("common.days.sat"),
    ],
    [t],
  );
};

export const useTodayDate = () => {
  return dayjs().format("YYYY-MM-DD");
};

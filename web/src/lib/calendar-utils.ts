import dayjs from "dayjs";

export const MONTH_DATE_FORMAT = "YYYY-MM" as const;

export const addMonths = (date: Date | string, count: number): string => {
  return dayjs(date).add(count, "month").format(MONTH_DATE_FORMAT);
};

import dayjs from "dayjs";

export const MONTH_DATE_FORMAT = "YYYY-MM" as const;

export const formatMonth = (date: Date | string): string => {
  return dayjs(date).format(MONTH_DATE_FORMAT);
};

export const getYearFromDate = (date: Date | string): number => {
  return dayjs(date).year();
};

export const getMonthFromDate = (date: Date | string): number => {
  return dayjs(date).month();
};

export const addMonths = (date: Date | string, count: number): string => {
  return dayjs(date).add(count, "month").format(MONTH_DATE_FORMAT);
};

export const setYearAndMonth = (year: number, month: number): string => {
  return dayjs().year(year).month(month).format(MONTH_DATE_FORMAT);
};

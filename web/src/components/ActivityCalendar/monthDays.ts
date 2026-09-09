import dayjs from "dayjs";
import { useMemo } from "react";
import type { CalendarData, CalendarDayCell } from "./types";

const DAYS_IN_WEEK = 7;

export interface MonthDaysParams {
  /** `YYYY-MM` */
  month: string;
  data: CalendarData;
  /** 0 = Sunday … 6 = Saturday; the instance's preferred first day of the week. */
  weekStartDayOffset: number;
  /** ISO date, `YYYY-MM-DD`. */
  today: string;
  selectedDate?: string;
}

/** Rotate a Sunday-first list of weekday labels so it starts on `weekStartDayOffset`. */
export const rotateWeekdays = <T>(labels: T[], weekStartDayOffset: number): T[] => {
  const offset = ((weekStartDayOffset % DAYS_IN_WEEK) + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  return labels.slice(offset).concat(labels.slice(0, offset));
};

/**
 * Every day of a month's grid in reading order, padded at both ends with out-of-month days so
 * the list is a whole number of weeks aligned to `weekStartDayOffset`.
 */
export const buildMonthDays = ({ month, data, weekStartDayOffset, today, selectedDate }: MonthDaysParams): CalendarDayCell[] => {
  const monthStart = dayjs(month).startOf("month");
  const monthEnd = monthStart.endOf("month");
  const monthKey = monthStart.format("YYYY-MM");

  const leadingDays = (monthStart.day() - weekStartDayOffset + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const trailingDays = (weekStartDayOffset + DAYS_IN_WEEK - 1 - monthEnd.day() + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const gridStart = monthStart.subtract(leadingDays, "day");
  const gridEnd = monthEnd.add(trailingDays, "day");
  const dayCount = gridEnd.diff(gridStart, "day") + 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const current = gridStart.add(index, "day");
    const date = current.format("YYYY-MM-DD");
    return {
      date,
      label: current.date(),
      count: data[date] ?? 0,
      isCurrentMonth: current.format("YYYY-MM") === monthKey,
      isToday: date === today,
      isSelected: date === selectedDate,
    };
  });
};

export const useMonthDays = (params: MonthDaysParams): CalendarDayCell[] => {
  const { month, data, weekStartDayOffset, today, selectedDate } = params;
  return useMemo(
    () => buildMonthDays({ month, data, weekStartDayOffset, today, selectedDate }),
    [month, data, weekStartDayOffset, today, selectedDate],
  );
};

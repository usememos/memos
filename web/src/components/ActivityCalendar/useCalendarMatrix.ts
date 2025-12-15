import dayjs from "dayjs";
import { useMemo } from "react";
import { DAYS_IN_WEEK, MIN_COUNT, WEEKEND_DAYS } from "./constants";
import type { CalendarDayCell, CalendarMatrixResult } from "./types";

export interface UseCalendarMatrixParams {
  month: string;
  data: Record<string, number>;
  weekDays: string[];
  weekStartDayOffset: number;
  today: string;
  selectedDate: string;
}

const createCalendarDayCell = (
  current: dayjs.Dayjs,
  monthKey: string,
  data: Record<string, number>,
  today: string,
  selectedDate: string,
): CalendarDayCell => {
  const isoDate = current.format("YYYY-MM-DD");
  const isCurrentMonth = current.format("YYYY-MM") === monthKey;
  const count = data[isoDate] ?? 0;

  return {
    date: isoDate,
    label: current.date(),
    count,
    isCurrentMonth,
    isToday: isoDate === today,
    isSelected: isoDate === selectedDate,
    isWeekend: WEEKEND_DAYS.includes(current.day() as 0 | 6),
  };
};

const calculateCalendarBoundaries = (monthStart: dayjs.Dayjs, weekStartDayOffset: number) => {
  const monthEnd = monthStart.endOf("month");
  const startOffset = (monthStart.day() - weekStartDayOffset + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const endOffset = (weekStartDayOffset + (DAYS_IN_WEEK - 1) - monthEnd.day() + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const calendarStart = monthStart.subtract(startOffset, "day");
  const calendarEnd = monthEnd.add(endOffset, "day");
  const dayCount = calendarEnd.diff(calendarStart, "day") + 1;

  return { calendarStart, dayCount };
};

export const useCalendarMatrix = ({
  month,
  data,
  weekDays,
  weekStartDayOffset,
  today,
  selectedDate,
}: UseCalendarMatrixParams): CalendarMatrixResult => {
  return useMemo(() => {
    const monthStart = dayjs(month).startOf("month");
    const monthKey = monthStart.format("YYYY-MM");

    const rotatedWeekDays = weekDays.slice(weekStartDayOffset).concat(weekDays.slice(0, weekStartDayOffset));

    const { calendarStart, dayCount } = calculateCalendarBoundaries(monthStart, weekStartDayOffset);

    const weeks: CalendarMatrixResult["weeks"] = [];
    let maxCount = 0;

    for (let index = 0; index < dayCount; index += 1) {
      const current = calendarStart.add(index, "day");
      const weekIndex = Math.floor(index / DAYS_IN_WEEK);

      if (!weeks[weekIndex]) {
        weeks[weekIndex] = { days: [] };
      }

      const dayCell = createCalendarDayCell(current, monthKey, data, today, selectedDate);
      weeks[weekIndex].days.push(dayCell);
      maxCount = Math.max(maxCount, dayCell.count);
    }

    return {
      weeks,
      weekDays: rotatedWeekDays,
      maxCount: Math.max(maxCount, MIN_COUNT),
    };
  }, [month, data, weekDays, weekStartDayOffset, today, selectedDate]);
};

import dayjs from "dayjs";
import { useMemo } from "react";
import type { CalendarDayCell, CalendarMatrixResult } from "./types";

interface UseCalendarMatrixParams {
  month: string;
  data: Record<string, number>;
  weekDays: string[];
  weekStartDayOffset: number;
  today: string;
  selectedDate: string;
}

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
    const monthEnd = monthStart.endOf("month");
    const monthKey = monthStart.format("YYYY-MM");

    const orderedWeekDays = weekDays.slice(weekStartDayOffset).concat(weekDays.slice(0, weekStartDayOffset));

    const startOffset = (monthStart.day() - weekStartDayOffset + 7) % 7;
    const endOffset = (weekStartDayOffset + 6 - monthEnd.day() + 7) % 7;

    const calendarStart = monthStart.subtract(startOffset, "day");
    const calendarEnd = monthEnd.add(endOffset, "day");
    const dayCount = calendarEnd.diff(calendarStart, "day") + 1;

    const weeks: CalendarMatrixResult["weeks"] = [];
    let maxCount = 0;

    for (let index = 0; index < dayCount; index += 1) {
      const current = calendarStart.add(index, "day");
      const isoDate = current.format("YYYY-MM-DD");
      const weekIndex = Math.floor(index / 7);

      if (!weeks[weekIndex]) {
        weeks[weekIndex] = { days: [] };
      }

      const isCurrentMonth = current.format("YYYY-MM") === monthKey;
      const count = data[isoDate] ?? 0;

      const dayCell: CalendarDayCell = {
        date: isoDate,
        label: current.date(),
        count,
        isCurrentMonth,
        isToday: isoDate === today,
        isSelected: isoDate === selectedDate,
        isWeekend: [0, 6].includes(current.day()),
      };

      weeks[weekIndex].days.push(dayCell);
      maxCount = Math.max(maxCount, count);
    }

    return {
      weeks,
      weekDays: orderedWeekDays,
      maxCount: Math.max(maxCount, 1),
    };
  }, [month, data, weekDays, weekStartDayOffset, today, selectedDate]);
};

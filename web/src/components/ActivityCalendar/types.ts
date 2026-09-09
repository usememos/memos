import type { MemoTimeBasis } from "@/contexts/ViewContext";

/** Memo counts keyed by ISO date (`YYYY-MM-DD`). */
export type CalendarData = Record<string, number>;

export interface CalendarDayCell {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Day of month, the numeral drawn in the cell. */
  label: number;
  count: number;
  /** False for the leading/trailing days that pad the grid out to whole weeks. */
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface MonthCalendarProps {
  /** Month to render, `YYYY-MM`. */
  month: string;
  data: CalendarData;
  /** ISO date of the day currently used as a filter, if any. */
  selectedDate?: string;
  onClick?: (date: string) => void;
  timeBasis?: MemoTimeBasis;
}

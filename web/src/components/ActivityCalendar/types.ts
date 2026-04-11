export type CalendarSize = "default" | "small";
export type CalendarData = Record<string, number>;

export interface CalendarDayCell {
  date: string;
  label: number;
  count: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface CalendarDayRow {
  days: CalendarDayCell[];
}

export interface CalendarMatrixResult {
  weeks: CalendarDayRow[];
  weekDays: string[];
}

export interface MonthCalendarProps {
  month: string;
  data: CalendarData;
  maxCount: number;
  size?: CalendarSize;
  onClick?: (date: string) => void;
  selectedDate?: string;
  className?: string;
  disableTooltips?: boolean;
}

export interface YearCalendarProps {
  selectedYear: number;
  data: CalendarData;
  onYearChange: (year: number) => void;
  onDateClick: (date: string) => void;
  className?: string;
}

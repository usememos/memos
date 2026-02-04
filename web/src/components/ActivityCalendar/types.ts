export type CalendarSize = "default" | "small";

export interface CalendarDayCell {
  date: string;
  label: number;
  count: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
}

export interface CalendarDayRow {
  days: CalendarDayCell[];
}

export interface CalendarMatrixResult {
  weeks: CalendarDayRow[];
  weekDays: string[];
  maxCount: number;
}

export interface MonthCalendarProps {
  month: string;
  data: Record<string, number>;
  maxCount: number;
  size?: CalendarSize;
  onClick?: (date: string) => void;
  className?: string;
  disableTooltips?: boolean;
}

export interface YearCalendarProps {
  selectedYear: number;
  data: Record<string, number>;
  onYearChange: (year: number) => void;
  onDateClick: (date: string) => void;
  className?: string;
}

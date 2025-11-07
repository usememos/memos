export interface ActivityData {
  date: string;
  count: number;
}

export interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  date?: string;
}

export interface StatisticsViewProps {
  className?: string;
}

export interface MonthNavigatorProps {
  visibleMonth: string;
  onMonthChange: (month: string) => void;
}

export interface ActivityCalendarProps {
  month: string;
  selectedDate: string;
  data: Record<string, number>;
  onClick?: (date: string) => void;
}

export interface StatisticsData {
  activityStats: Record<string, number>;
}

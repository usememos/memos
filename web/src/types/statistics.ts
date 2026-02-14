export interface StatisticsViewProps {
  className?: string;
}

export interface MonthNavigatorProps {
  visibleMonth: string;
  onMonthChange: (month: string) => void;
  activityStats: Record<string, number>;
  language: string;
}

export interface StatisticsData {
  activityStats: Record<string, number>;
}

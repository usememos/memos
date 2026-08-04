import type { MemoTimeBasis } from "@/contexts/ViewContext";

export interface StatisticsViewProps {
  className?: string;
}

export interface MonthNavigatorProps {
  visibleMonth: string;
  onMonthChange: (month: string) => void;
}

export interface StatisticsData {
  activityStats: Record<string, number>;
  timeBasis: MemoTimeBasis;
}

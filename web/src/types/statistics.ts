import { UserStats_MemoTypeStats } from "@/types/proto/api/v1/user_service";

export interface ActivityData {
  date: string;
  count: number;
}

export interface CalendarDay {
  day: number;
  isCurrentMonth: boolean;
  date?: string;
}

export interface StatCardData {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  filter: {
    factor: string;
    value?: string;
  };
  tooltip?: string;
  visible?: boolean;
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

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  count: number | React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

export interface StatisticsData {
  memoTypeStats: UserStats_MemoTypeStats;
  activityStats: Record<string, number>;
}

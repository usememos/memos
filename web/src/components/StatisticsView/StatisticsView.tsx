import dayjs from "dayjs";
import { useState } from "react";
import { calculateMaxCount, MonthCalendar } from "@/components/ActivityCalendar";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useDateFilterNavigation, useLocalStorage } from "@/hooks";
import { cn } from "@/lib/utils";
import type { StatisticsData } from "@/types/statistics";
import { MonthNavigator } from "./MonthNavigator";

interface Props {
  statisticsData: StatisticsData;
  onDateSelect?: () => void;
  /** When set, day clicks land on this route with the date filter instead of filtering the current one. */
  navigationTarget?: string;
}

const STATISTICS_CALENDAR_COLLAPSED_KEY = "statistics-calendar-collapsed";

const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats, timeBasis } = statisticsData;
  const { filters } = useMemoFilterContext();
  const navigateToDateFilter = useDateFilterNavigation(props.navigationTarget);
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(STATISTICS_CALENDAR_COLLAPSED_KEY, false);
  const selectedDate = filters.find((filter) => filter.factor === "displayTime")?.value;

  return (
    <div className="group flex w-full flex-col text-muted-foreground animate-fade-in">
      <MonthNavigator
        visibleMonth={visibleMonthString}
        onMonthChange={setVisibleMonthString}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />

      {/* Grid-rows trick: animates height without measuring it, and collapses to zero
          without unmounting the calendar (keeps its internal state across toggles). */}
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
        <div className="overflow-hidden">
          <div className="w-full animate-scale-in">
            <MonthCalendar
              month={visibleMonthString}
              data={activityStats}
              maxCount={calculateMaxCount(activityStats)}
              selectedDate={selectedDate}
              onClick={(date) => {
                navigateToDateFilter(date);
                props.onDateSelect?.();
              }}
              timeBasis={timeBasis}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsView;

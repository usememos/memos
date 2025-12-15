import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useMemo, useState } from "react";
import { CompactMonthCalendar } from "@/components/ActivityCalendar";
import { useDateFilterNavigation } from "@/hooks";
import type { StatisticsData } from "@/types/statistics";
import { MonthNavigator } from "./MonthNavigator";

export type StatisticsViewContext = "home" | "explore" | "archived" | "profile";

interface Props {
  context?: StatisticsViewContext;
  statisticsData: StatisticsData;
}

const StatisticsView = observer((props: Props) => {
  const { statisticsData } = props;
  const { activityStats } = statisticsData;
  const navigateToDateFilter = useDateFilterNavigation();
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));

  const maxCount = useMemo(() => {
    const counts = Object.values(activityStats);
    return Math.max(...counts, 1);
  }, [activityStats]);

  return (
    <div className="group w-full mt-2 space-y-1 text-muted-foreground animate-fade-in">
      <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} />

      <div className="w-full animate-scale-in">
        <CompactMonthCalendar month={visibleMonthString} data={activityStats} maxCount={maxCount} onClick={navigateToDateFilter} />
      </div>
    </div>
  );
});

export default StatisticsView;

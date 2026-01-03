import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import { useDateFilterNavigation } from "@/hooks";
import type { StatisticsData } from "@/types/statistics";
import { MonthNavigator } from "./MonthNavigator";

interface Props {
  statisticsData: StatisticsData;
}

const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats } = statisticsData;
  const navigateToDateFilter = useDateFilterNavigation();
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));

  const maxCount = useMemo(() => {
    const counts = Object.values(activityStats);
    return Math.max(...counts, 1);
  }, [activityStats]);

  return (
    <div className="group w-full mt-2 flex flex-col text-muted-foreground animate-fade-in">
      <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} activityStats={activityStats} />

      <div className="w-full animate-scale-in">
        <MonthCalendar month={visibleMonthString} data={activityStats} maxCount={maxCount} onClick={navigateToDateFilter} />
      </div>
    </div>
  );
};

export default StatisticsView;

import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import type { StatisticsData } from "@/types/statistics";
import { MonthNavigator } from "./MonthNavigator";

interface Props {
  statisticsData: StatisticsData;
}

const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats } = statisticsData;
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();
  const displayTimeFilter = getFiltersByFactor("displayTime").length > 0 ? getFiltersByFactor("displayTime") : [];
  const selectedDate = useMemo(() => {
    if (!displayTimeFilter.length) return null;
    return new Date(displayTimeFilter[0].value);
  }, [displayTimeFilter]);

  const maxCount = useMemo(() => {
    const counts = Object.values(activityStats);
    return Math.max(...counts, 1);
  }, [activityStats]);

  const handleDateCellClick = (date: string) => {
    if (displayTimeFilter.length > 0 && displayTimeFilter[0].value === date) {
      removeFilter((f: MemoFilter) => f.factor === "displayTime" && f.value === date);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "displayTime");
      addFilter({
        factor: "displayTime",
        value: date,
      });
    }
  };

  return (
    <div className="group w-full mt-2 flex flex-col text-muted-foreground animate-fade-in">
      <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} activityStats={activityStats} />

      <div className="w-full animate-scale-in">
        <MonthCalendar
          month={visibleMonthString}
          selectedDate={selectedDate ? selectedDate.toDateString() : null}
          data={activityStats}
          maxCount={maxCount}
          onClick={handleDateCellClick}
        />
      </div>
    </div>
  );
};

export default StatisticsView;

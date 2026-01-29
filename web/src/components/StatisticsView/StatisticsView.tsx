import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import type { StatisticsData } from "@/types/statistics";
import { MonthNavigator } from "./MonthNavigator";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";

interface Props {
  statisticsData: StatisticsData;
}

const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats } = statisticsData;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));
  const { getFiltersByFactor, addFilter, removeFilter } = useMemoFilterContext();

  const maxCount = useMemo(() => {
    const counts = Object.values(activityStats);
    return Math.max(...counts, 1);
  }, [activityStats]);

  const handleClick = (date: string) =>{
    const displayTimeFilters = getFiltersByFactor("displayTime");
    const isActive = displayTimeFilters.some((f: MemoFilter) => f.value === date);

    if (isActive) {
      removeFilter((f: MemoFilter) => f.factor === "displayTime" && f.value === date);
      setSelectedDate(null);
    } else {
      // Remove all existing tag filters first, then add the new one
      removeFilter((f: MemoFilter) => f.factor === "displayTime");
      addFilter({
        factor: "displayTime",
        value: date,
      });
      setSelectedDate(new Date(date));
    }
  }; 

  return (
    <div className="group w-full mt-2 flex flex-col text-muted-foreground animate-fade-in">
      <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} activityStats={activityStats} />

      <div className="w-full animate-scale-in">
        <MonthCalendar month={visibleMonthString} selectedDate={selectedDate?.toDateString()} data={activityStats} maxCount={maxCount} onClick={handleClick} />
      </div>
    </div>
  );
};

export default StatisticsView;

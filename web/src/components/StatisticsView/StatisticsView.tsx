import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";
import memoFilterStore from "@/store/memoFilter";
import type { StatisticsData } from "@/types/statistics";
import ActivityCalendar from "../ActivityCalendar";
import { MonthNavigator } from "./MonthNavigator";

export type StatisticsViewContext = "home" | "explore" | "archived" | "profile";

interface Props {
  /**
   * Context for the statistics view
   * Affects which stat cards are shown
   * Default: "home"
   */
  context?: StatisticsViewContext;

  /**
   * Statistics data computed from filtered memos
   * Should be provided by parent component using useFilteredMemoStats
   */
  statisticsData: StatisticsData;
}

const StatisticsView = observer((props: Props) => {
  const { statisticsData } = props;
  const { activityStats } = statisticsData;
  const [selectedDate] = useState(new Date());
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));

  const handleCalendarClick = useCallback((date: string) => {
    memoFilterStore.removeFilter((f) => f.factor === "displayTime");
    memoFilterStore.addFilter({ factor: "displayTime", value: date });
  }, []);

  return (
    <div className="group w-full mt-2 space-y-1 text-muted-foreground animate-fade-in">
      <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} />

      <div className="w-full animate-scale-in">
        <ActivityCalendar
          month={visibleMonthString}
          selectedDate={selectedDate.toDateString()}
          data={activityStats}
          onClick={handleCalendarClick}
        />
      </div>
    </div>
  );
});

export default StatisticsView;

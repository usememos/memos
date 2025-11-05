import dayjs from "dayjs";
import { CheckCircleIcon, Code2Icon, LinkIcon, ListTodoIcon, BookmarkIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState, useCallback } from "react";
import { matchPath, useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Routes } from "@/router";
import { userStore } from "@/store";
import memoFilterStore, { FilterFactor } from "@/store/memoFilter";
import type { StatisticsData } from "@/types/statistics";
import { useTranslate } from "@/utils/i18n";
import ActivityCalendar from "../ActivityCalendar";
import { MonthNavigator } from "./MonthNavigator";
import { StatCard } from "./StatCard";

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
  const { context = "home", statisticsData } = props;
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();

  const { memoTypeStats, activityStats } = statisticsData;

  const [selectedDate] = useState(new Date());
  const [visibleMonthString, setVisibleMonthString] = useState(dayjs().format("YYYY-MM"));

  const handleCalendarClick = useCallback((date: string) => {
    memoFilterStore.removeFilter((f) => f.factor === "displayTime");
    memoFilterStore.addFilter({ factor: "displayTime", value: date });
  }, []);

  const handleFilterClick = useCallback((factor: FilterFactor, value: string = "") => {
    memoFilterStore.addFilter({ factor, value });
  }, []);

  const isRootPath = matchPath(Routes.ROOT, location.pathname);
  const hasPinnedMemos = currentUser && (userStore.state.currentUserStats?.pinnedMemos || []).length > 0;

  // Determine if we should show the pinned stat card
  // Only show on home page (root path) for the current user with pinned memos
  // Don't show on explore page since it's global
  const shouldShowPinned = context === "home" && isRootPath && hasPinnedMemos;

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

      <div className="pt-2 w-full flex flex-wrap items-center gap-2">
        {shouldShowPinned && (
          <StatCard
            icon={<BookmarkIcon className="opacity-70" />}
            label={t("common.pinned")}
            count={userStore.state.currentUserStats!.pinnedMemos.length}
            onClick={() => handleFilterClick("pinned")}
          />
        )}

        <StatCard
          icon={<LinkIcon className="opacity-70" />}
          label={t("memo.links")}
          count={memoTypeStats.linkCount}
          onClick={() => handleFilterClick("property.hasLink")}
        />

        <StatCard
          icon={memoTypeStats.undoCount > 0 ? <ListTodoIcon className="opacity-70" /> : <CheckCircleIcon className="opacity-70" />}
          label={t("memo.to-do")}
          count={
            memoTypeStats.undoCount > 0 ? (
              <div className="text-sm flex flex-row items-start justify-center">
                <span className="truncate">{memoTypeStats.todoCount - memoTypeStats.undoCount}</span>
                <span className="font-mono opacity-50">/</span>
                <span className="truncate">{memoTypeStats.todoCount}</span>
              </div>
            ) : (
              memoTypeStats.todoCount
            )
          }
          onClick={() => handleFilterClick("property.hasTaskList")}
          tooltip={memoTypeStats.undoCount > 0 ? "Done / Total" : undefined}
        />

        <StatCard
          icon={<Code2Icon className="opacity-70" />}
          label={t("memo.code")}
          count={memoTypeStats.codeCount}
          onClick={() => handleFilterClick("property.hasCode")}
        />
      </div>
    </div>
  );
});

export default StatisticsView;

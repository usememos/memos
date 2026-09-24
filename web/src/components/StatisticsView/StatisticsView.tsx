import { CalendarDaysIcon, LayoutGridIcon } from "lucide-react";
import { useState } from "react";
import { MonthCalendar } from "@/components/ActivityCalendar";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useDateFilterNavigation } from "@/hooks";
import { getCurrentMonth } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { StatisticsData } from "@/types/statistics";
import { useTranslate } from "@/utils/i18n";
import { MonthNavigator } from "./MonthNavigator";
import UsageHeatmap from "./UsageHeatmap";

interface Props {
  statisticsData: StatisticsData;
  onDateSelect?: () => void;
}

type StatisticsViewMode = "heatmap" | "calendar";

const STATISTICS_VIEW_MODE_KEY = "memos.statistics-view-mode";

const readInitialMode = (): StatisticsViewMode =>
  typeof localStorage !== "undefined" && localStorage.getItem(STATISTICS_VIEW_MODE_KEY) === "calendar" ? "calendar" : "heatmap";

const StatisticsView = (props: Props) => {
  const { statisticsData } = props;
  const { activityStats, timeBasis } = statisticsData;
  const t = useTranslate();
  const { filters } = useMemoFilterContext();
  const navigateToDateFilter = useDateFilterNavigation();
  const [visibleMonthString, setVisibleMonthString] = useState(getCurrentMonth);
  const [mode, setMode] = useState<StatisticsViewMode>(readInitialMode);
  const selectedDate = filters.find((filter) => filter.factor === "displayTime")?.value;

  const switchMode = () => {
    const next = mode === "heatmap" ? "calendar" : "heatmap";
    localStorage.setItem(STATISTICS_VIEW_MODE_KEY, next);
    setMode(next);
  };

  const handleDateClick = (date: string) => {
    navigateToDateFilter(date);
    props.onDateSelect?.();
  };

  const toggleLabel = mode === "heatmap" ? t("heatmap.show-calendar") : t("heatmap.show-heatmap");
  const modeToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="quiet" size="icon-sm" onClick={switchMode} aria-label={toggleLabel}>
            {mode === "heatmap" ? (
              <CalendarDaysIcon className="size-4" strokeWidth={1.75} />
            ) : (
              <LayoutGridIcon className="size-4" strokeWidth={1.75} />
            )}
          </Button>
        }
      />
      <TooltipContent side="top">
        <p>{toggleLabel}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="group flex w-full flex-col text-muted-foreground animate-fade-in">
      {mode === "calendar" ? (
        <>
          <MonthNavigator visibleMonth={visibleMonthString} onMonthChange={setVisibleMonthString} action={modeToggle} />
          <div className="w-full animate-scale-in">
            <MonthCalendar
              month={visibleMonthString}
              data={activityStats}
              selectedDate={selectedDate}
              onClick={handleDateClick}
              timeBasis={timeBasis}
            />
          </div>
        </>
      ) : (
        <>
          <header className={cn(SIDEBAR_ROW_BOX_CLASSES, "mb-1.5 justify-between")}>
            <h2 className="min-w-0 truncate font-medium tracking-[-0.015em] text-foreground/90 select-none">{t("heatmap.title")}</h2>
            <nav className="flex shrink-0 items-center gap-0.5">{modeToggle}</nav>
          </header>
          <div className="w-full animate-scale-in">
            <UsageHeatmap data={activityStats} selectedDate={selectedDate} onClick={handleDateClick} timeBasis={timeBasis} />
          </div>
        </>
      )}
    </div>
  );
};

export default StatisticsView;

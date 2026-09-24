import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ActivityLevel,
  calculateMaxCount,
  getActivityLevel,
  getTooltipText,
  useWeekdayLabels,
  WEEKDAY_LABEL_CLASSES,
} from "@/components/ActivityCalendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useInstance } from "@/contexts/InstanceContext";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { buildHeatmapColumns, type HeatmapDay, summarizeActivity, weeksForWidth } from "./usageHeatmap";

interface Props {
  data: Record<string, number>;
  selectedDate?: string;
  timeBasis?: MemoTimeBasis;
  onClick?: (date: string) => void;
}

/** flomo-style green ladder; level 0 is a day without records. */
const LEVEL_FILLS: Record<ActivityLevel, string> = {
  0: "bg-muted hover:bg-muted/60",
  1: "bg-green-200 hover:bg-green-300 dark:bg-green-900 dark:hover:bg-green-800",
  2: "bg-green-300 hover:bg-green-400 dark:bg-green-800 dark:hover:bg-green-700",
  3: "bg-green-400 hover:bg-green-500 dark:bg-green-700 dark:hover:bg-green-600",
  4: "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500",
};

const CELL_CLASSES = "size-[11px] rounded-[3px]";
/** Rows 0/2/4/6 carry a weekday initial, flomo shows Mon/Wed/Fri/Sun on a Monday-first grid. */
const LABELED_ROWS = new Set([0, 2, 4, 6]);

interface HeatmapCellProps {
  day: HeatmapDay;
  count: number;
  maxCount: number;
  selected: boolean;
  timeBasis: MemoTimeBasis;
  onClick?: (date: string) => void;
}

const HeatmapCell = ({ day, count, maxCount, selected, timeBasis, onClick }: HeatmapCellProps) => {
  const t = useTranslate();
  const tooltipText = getTooltipText(count, day.date, t, timeBasis);
  const level = getActivityLevel(count, maxCount);

  const button = (
    <button
      type="button"
      onClick={() => onClick?.(day.date)}
      aria-label={tooltipText}
      aria-current={day.isToday ? "date" : undefined}
      className={cn(
        CELL_CLASSES,
        "p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        LEVEL_FILLS[level],
        day.isToday && "ring-1 ring-inset ring-foreground/70",
        selected && "ring-2 ring-inset ring-primary",
      )}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const UsageHeatmap = ({ data, selectedDate, timeBasis = "create_time", onClick }: Props) => {
  const t = useTranslate();
  const { generalSetting } = useInstance();
  const weekStartDayOffset = generalSetting.weekStartDayOffset;
  const weekDays = useWeekdayLabels(weekStartDayOffset);
  const containerRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(12);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWeeks(weeksForWidth(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maxCount = useMemo(() => calculateMaxCount(data), [data]);
  const columns = useMemo(() => buildHeatmapColumns(weeks, weekStartDayOffset), [weeks, weekStartDayOffset]);
  const summary = useMemo(() => summarizeActivity(data), [data]);

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex w-full">
        {/* Weekday initials down the left edge, aligned with the grid rows. */}
        <div className="mr-1.5 flex shrink-0 flex-col gap-[3px]" aria-hidden="true">
          {weekDays.map((label, index) => (
            <span key={index} className={cn("flex size-[11px] items-center leading-none", WEEKDAY_LABEL_CLASSES)}>
              {LABELED_ROWS.has(index) ? Array.from(label)[0] : ""}
            </span>
          ))}
        </div>

        <div className="flex gap-[3px]" role="group" aria-label={t("heatmap.title")}>
          {columns.map((week) => (
            <div key={week[0].date} className="flex flex-col gap-[3px]">
              {week.map((day) =>
                day.isFuture ? (
                  <span key={day.date} className={CELL_CLASSES} aria-hidden="true" />
                ) : (
                  <HeatmapCell
                    key={day.date}
                    day={day}
                    count={data[day.date] ?? 0}
                    maxCount={maxCount}
                    selected={selectedDate === day.date}
                    timeBasis={timeBasis}
                    onClick={onClick}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        {t("heatmap.stats-summary", { total: summary.total, days: summary.days, streak: summary.streak })}
      </p>
    </div>
  );
};

export default UsageHeatmap;

import { memo, useMemo } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { useTodayDate, useWeekdayLabels } from "./hooks";
import type { CalendarSize, MonthCalendarProps } from "./types";
import { useCalendarMatrix } from "./useCalendar";
import { getTooltipText } from "./utils";

const GRID_STYLES: Record<CalendarSize, { gap: string; headerText: string }> = {
  small: { gap: "gap-1.5", headerText: "text-[10px]" },
  default: { gap: "gap-2", headerText: "text-xs" },
};

interface WeekdayHeaderProps {
  weekDays: string[];
  size: CalendarSize;
}

const WeekdayHeader = memo(({ weekDays, size }: WeekdayHeaderProps) => (
  <div className={cn("grid grid-cols-7 mb-1", GRID_STYLES[size].gap, GRID_STYLES[size].headerText)} role="row">
    {weekDays.map((label, index) => (
      <div
        key={index}
        className="flex h-4 items-center justify-center font-medium uppercase tracking-wide text-muted-foreground/60"
        role="columnheader"
        aria-label={label}
      >
        {label}
      </div>
    ))}
  </div>
));
WeekdayHeader.displayName = "WeekdayHeader";

export const MonthCalendar = memo((props: MonthCalendarProps) => {
  const { month, data, maxCount, size = "default", onClick, className, disableTooltips = false } = props;
  const t = useTranslate();
  const { generalSetting } = useInstance();
  const today = useTodayDate();
  const weekDays = useWeekdayLabels();

  const { weeks, weekDays: rotatedWeekDays } = useCalendarMatrix({
    month,
    data,
    weekDays,
    weekStartDayOffset: generalSetting.weekStartDayOffset,
    today,
    selectedDate: "",
  });

  const flatDays = useMemo(() => weeks.flatMap((week) => week.days), [weeks]);

  return (
    <div className={cn("flex flex-col", className)} role="grid" aria-label={`Calendar for ${month}`}>
      <WeekdayHeader weekDays={rotatedWeekDays} size={size} />

      <div className={cn("grid grid-cols-7", GRID_STYLES[size].gap)} role="rowgroup">
        {flatDays.map((day) => (
          <CalendarCell
            key={day.date}
            day={day}
            maxCount={maxCount}
            tooltipText={getTooltipText(day.count, day.date, t)}
            onClick={onClick}
            size={size}
            disableTooltip={disableTooltips}
          />
        ))}
      </div>
    </div>
  );
});

MonthCalendar.displayName = "MonthCalendar";

import { memo } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { useTodayDate, useWeekdayLabels } from "./hooks";
import type { MonthCalendarProps } from "./types";
import { useCalendarMatrix } from "./useCalendar";
import { getTooltipText } from "./utils";

export const MonthCalendar = memo((props: MonthCalendarProps) => {
  const { month, data, maxCount, size = "default", onClick, className } = props;
  const t = useTranslate();
  const { generalSetting } = useInstance();

  const weekStartDayOffset = generalSetting.weekStartDayOffset;

  const today = useTodayDate();
  const weekDays = useWeekdayLabels();

  const { weeks, weekDays: rotatedWeekDays } = useCalendarMatrix({
    month,
    data,
    weekDays,
    weekStartDayOffset,
    today,
    selectedDate: "",
  });

  const gridGap = size === "small" ? "gap-x-3 gap-y-3" : "gap-x-3.5 gap-y-3.5";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn("grid grid-cols-7", gridGap, "text-muted-foreground mb-1", size === "small" ? "text-[10px]" : "text-xs")}>
        {rotatedWeekDays.map((label, index) => (
          <div key={index} className="flex h-4 items-center justify-center text-muted-foreground/70 font-medium uppercase tracking-wide">
            {label}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 px-2", gridGap)}>
        {weeks.map((week, weekIndex) =>
          week.days.map((day, dayIndex) => {
            const tooltipText = getTooltipText(day.count, day.date, t);

            return (
              <CalendarCell
                key={`${weekIndex}-${dayIndex}-${day.date}`}
                day={day}
                maxCount={maxCount}
                tooltipText={tooltipText}
                onClick={onClick}
                size={size}
              />
            );
          }),
        )}
      </div>
    </div>
  );
});

MonthCalendar.displayName = "MonthCalendar";

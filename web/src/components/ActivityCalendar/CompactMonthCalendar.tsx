import { memo } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { DEFAULT_CELL_SIZE, SMALL_CELL_SIZE } from "./constants";
import { getTooltipText, useTodayDate, useWeekdayLabels } from "./shared";
import type { CompactMonthCalendarProps } from "./types";
import { useCalendarMatrix } from "./useCalendarMatrix";

export const CompactMonthCalendar = memo((props: CompactMonthCalendarProps) => {
  const { month, data, maxCount, size = "default", onClick } = props;
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

  const sizeConfig = size === "small" ? SMALL_CELL_SIZE : DEFAULT_CELL_SIZE;

  return (
    <div className="flex flex-col gap-1">
      <div className={cn("grid grid-cols-7 gap-0.5 text-muted-foreground", size === "small" ? "text-[10px]" : "text-xs")}>
        {rotatedWeekDays.map((label, index) => (
          <div key={index} className="flex h-4 items-center justify-center text-muted-foreground/50">
            {label}
          </div>
        ))}
      </div>

      <div className={cn("grid grid-cols-7", sizeConfig.gap)}>
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

CompactMonthCalendar.displayName = "CompactMonthCalendar";

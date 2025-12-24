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

  const { weeks } = useCalendarMatrix({
    month,
    data,
    weekDays,
    weekStartDayOffset,
    today,
    selectedDate: "",
  });

  const sizeConfig = size === "small" ? SMALL_CELL_SIZE : DEFAULT_CELL_SIZE;

  return (
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
  );
});

CompactMonthCalendar.displayName = "CompactMonthCalendar";

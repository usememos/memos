import { memo, useMemo } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { getToday } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { rotateWeekdays, useMonthDays } from "./monthDays";
import type { MonthCalendarProps } from "./types";
import { calculateMaxCount, getTooltipText } from "./utils";

/** The type of a weekday column label, shared by every month grid. */
export const WEEKDAY_LABEL_CLASSES = "text-2xs font-medium uppercase tracking-[0.04em] text-muted-foreground/50";

/** Localized weekday labels starting on the instance's first day of the week. */
export const useWeekdayLabels = (weekStartDayOffset: number) => {
  const t = useTranslate();
  return useMemo(
    () =>
      rotateWeekdays(
        [
          t("common.days.sun"),
          t("common.days.mon"),
          t("common.days.tue"),
          t("common.days.wed"),
          t("common.days.thu"),
          t("common.days.fri"),
          t("common.days.sat"),
        ],
        weekStartDayOffset,
      ),
    [t, weekStartDayOffset],
  );
};

export const MonthCalendar = memo(({ month, data, selectedDate, onClick, timeBasis = "create_time" }: MonthCalendarProps) => {
  const t = useTranslate();
  const { generalSetting } = useInstance();
  const weekDays = useWeekdayLabels(generalSetting.weekStartDayOffset);
  const maxCount = useMemo(() => calculateMaxCount(data), [data]);
  const days = useMonthDays({
    month,
    data,
    weekStartDayOffset: generalSetting.weekStartDayOffset,
    today: getToday(),
    selectedDate,
  });

  return (
    <div className="flex flex-col" role="group" aria-label={`Calendar for ${month}`}>
      {/* Every day button already announces its full date, so the initials are decoration. */}
      <div className="mb-1.5 grid grid-cols-7 gap-1" aria-hidden="true">
        {weekDays.map((label, index) => (
          <div key={index} className={cn("flex h-5 items-center justify-center", WEEKDAY_LABEL_CLASSES)}>
            {Array.from(label)[0]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <CalendarCell
            key={day.date}
            day={day}
            maxCount={maxCount}
            tooltipText={getTooltipText(day.count, day.date, t, timeBasis)}
            onClick={onClick}
          />
        ))}
      </div>
    </div>
  );
});

MonthCalendar.displayName = "MonthCalendar";

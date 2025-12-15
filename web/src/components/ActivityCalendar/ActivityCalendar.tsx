import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { memo, useMemo } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { instanceStore } from "@/store";
import type { ActivityCalendarProps } from "@/types/statistics";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { getTooltipText, useTodayDate, useWeekdayLabels } from "./shared";
import { useCalendarMatrix } from "./useCalendarMatrix";

export const ActivityCalendar = memo(
  observer((props: ActivityCalendarProps) => {
    const t = useTranslate();
    const { month, selectedDate, data, onClick } = props;
    const weekStartDayOffset = instanceStore.state.generalSetting.weekStartDayOffset;

    const today = useTodayDate();
    const weekDaysRaw = useWeekdayLabels();
    const selectedDateFormatted = useMemo(() => dayjs(selectedDate).format("YYYY-MM-DD"), [selectedDate]);

    const { weeks, weekDays, maxCount } = useCalendarMatrix({
      month,
      data,
      weekDays: weekDaysRaw,
      weekStartDayOffset,
      today,
      selectedDate: selectedDateFormatted,
    });

    return (
      <TooltipProvider>
        <div className="w-full flex flex-col gap-0.5">
          <div className="grid grid-cols-7 gap-0.5 text-xs text-muted-foreground">
            {weekDays.map((label, index) => (
              <div key={index} className="flex h-4 items-center justify-center text-muted-foreground/80">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
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
                  />
                );
              }),
            )}
          </div>
        </div>
      </TooltipProvider>
    );
  }),
);

ActivityCalendar.displayName = "ActivityCalendar";

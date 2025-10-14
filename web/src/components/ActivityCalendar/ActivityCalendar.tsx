import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { memo, useMemo } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workspaceStore } from "@/store";
import type { ActivityCalendarProps } from "@/types/statistics";
import { useTranslate } from "@/utils/i18n";
import { CalendarCell } from "./CalendarCell";
import { useCalendarMatrix } from "./useCalendarMatrix";

export const ActivityCalendar = memo(
  observer((props: ActivityCalendarProps) => {
    const t = useTranslate();
    const { month, selectedDate, data, onClick } = props;
    const weekStartDayOffset = workspaceStore.state.generalSetting.weekStartDayOffset;

    const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
    const selectedDateFormatted = useMemo(() => dayjs(selectedDate).format("YYYY-MM-DD"), [selectedDate]);

    const weekDaysRaw = useMemo(
      () => [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")],
      [t],
    );

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
        <div className="w-full flex flex-col gap-1">
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
            {weekDays.map((label, index) => (
              <div key={index} className="flex h-5 items-center justify-center text-muted-foreground/80">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weeks.map((week, weekIndex) =>
              week.days.map((day, dayIndex) => {
                const tooltipText =
                  day.count === 0
                    ? day.date
                    : t("memo.count-memos-in-date", {
                        count: day.count,
                        memos: day.count === 1 ? t("common.memo") : t("common.memos"),
                        date: day.date,
                      }).toLowerCase();

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

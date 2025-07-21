import dayjs from "dayjs";
import { observer } from "mobx-react-lite";
import { memo, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { workspaceStore } from "@/store";
import type { ActivityCalendarProps, CalendarDay } from "@/types/statistics";
import { useTranslate } from "@/utils/i18n";

const getCellOpacity = (ratio: number): string => {
  if (ratio === 0) return "";
  if (ratio > 0.75) return "bg-destructive text-destructive-foreground";
  if (ratio > 0.5) return "bg-destructive/70 text-destructive-foreground";
  if (ratio > 0.25) return "bg-destructive/50 text-destructive-foreground";
  return "bg-destructive/30 text-destructive-foreground";
};

const CalendarCell = memo(
  ({
    dayInfo,
    count,
    maxCount,
    isToday,
    isSelected,
    onClick,
    tooltipText,
  }: {
    dayInfo: CalendarDay;
    count: number;
    maxCount: number;
    isToday: boolean;
    isSelected: boolean;
    onClick?: () => void;
    tooltipText: string;
  }) => {
    const cellContent = (
      <div
        className={cn(
          "w-6 h-6 text-xs lg:text-[13px] flex justify-center items-center cursor-default",
          "rounded-lg border-2 text-muted-foreground transition-all duration-200",
          dayInfo.isCurrentMonth && getCellOpacity(count / maxCount),
          dayInfo.isCurrentMonth && isToday && "border-border",
          dayInfo.isCurrentMonth && isSelected && "font-medium border-border",
          dayInfo.isCurrentMonth && !isToday && !isSelected && "border-transparent",
          count > 0 && "cursor-pointer hover:scale-110",
        )}
        onClick={count > 0 ? onClick : undefined}
      >
        {dayInfo.day}
      </div>
    );

    if (!dayInfo.isCurrentMonth) {
      return (
        <div
          className={cn("w-6 h-6 text-xs lg:text-[13px] flex justify-center items-center cursor-default opacity-60 text-muted-foreground")}
        >
          {dayInfo.day}
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="shrink-0">{cellContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

export const ActivityCalendar = memo(
  observer((props: ActivityCalendarProps) => {
    const t = useTranslate();
    const { month: monthStr, data, onClick } = props;
    const weekStartDayOffset = workspaceStore.state.generalSetting.weekStartDayOffset;

    const { days, weekDays, maxCount } = useMemo(() => {
      const yearValue = dayjs(monthStr).toDate().getFullYear();
      const monthValue = dayjs(monthStr).toDate().getMonth();
      const dayInMonth = new Date(yearValue, monthValue + 1, 0).getDate();
      const firstDay = (((new Date(yearValue, monthValue, 1).getDay() - weekStartDayOffset) % 7) + 7) % 7;
      const lastDay = new Date(yearValue, monthValue, dayInMonth).getDay() - weekStartDayOffset;
      const prevMonthDays = new Date(yearValue, monthValue, 0).getDate();

      const WEEK_DAYS = [t("days.sun"), t("days.mon"), t("days.tue"), t("days.wed"), t("days.thu"), t("days.fri"), t("days.sat")];
      const weekDaysOrdered = WEEK_DAYS.slice(weekStartDayOffset).concat(WEEK_DAYS.slice(0, weekStartDayOffset));

      const daysArray: CalendarDay[] = [];

      // Previous month's days
      for (let i = firstDay - 1; i >= 0; i--) {
        daysArray.push({ day: prevMonthDays - i, isCurrentMonth: false });
      }

      // Current month's days
      for (let i = 1; i <= dayInMonth; i++) {
        const date = dayjs(`${yearValue}-${monthValue + 1}-${i}`).format("YYYY-MM-DD");
        daysArray.push({ day: i, isCurrentMonth: true, date });
      }

      // Next month's days
      for (let i = 1; i < 7 - lastDay; i++) {
        daysArray.push({ day: i, isCurrentMonth: false });
      }

      const maxCountValue = Math.max(...Object.values(data), 1);

      return {
        year: yearValue,
        month: monthValue,
        days: daysArray,
        weekDays: weekDaysOrdered,
        maxCount: maxCountValue,
      };
    }, [monthStr, data, weekStartDayOffset, t]);

    const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
    const selectedDateFormatted = useMemo(() => dayjs(props.selectedDate).format("YYYY-MM-DD"), [props.selectedDate]);

    return (
      <div className={cn("w-full h-auto shrink-0 grid grid-cols-7 grid-flow-row gap-1")}>
        {weekDays.map((day, index) => (
          <div key={index} className={cn("w-6 h-5 text-xs flex justify-center items-center cursor-default opacity-60")}>
            {day}
          </div>
        ))}
        {days.map((dayInfo, index) => {
          if (!dayInfo.isCurrentMonth) {
            return (
              <CalendarCell
                key={`prev-next-${index}`}
                dayInfo={dayInfo}
                count={0}
                maxCount={maxCount}
                isToday={false}
                isSelected={false}
                tooltipText=""
              />
            );
          }

          const date = dayInfo.date!;
          const count = data[date] || 0;
          const isToday = today === date;
          const isSelected = selectedDateFormatted === date;
          const tooltipText =
            count === 0
              ? date
              : t("memo.count-memos-in-date", {
                  count: count,
                  memos: count === 1 ? t("common.memo") : t("common.memos"),
                  date: date,
                }).toLowerCase();

          return (
            <CalendarCell
              key={date}
              dayInfo={dayInfo}
              count={count}
              maxCount={maxCount}
              isToday={isToday}
              isSelected={isSelected}
              onClick={() => onClick?.(date)}
              tooltipText={tooltipText}
            />
          );
        })}
      </div>
    );
  }),
);

ActivityCalendar.displayName = "ActivityCalendar";

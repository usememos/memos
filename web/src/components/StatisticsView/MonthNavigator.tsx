import dayjs from "dayjs";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import i18n from "@/i18n";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = ({ visibleMonth, onMonthChange }: MonthNavigatorProps) => {
  const currentMonth = dayjs(visibleMonth).toDate();

  const handlePrevMonth = () => {
    onMonthChange(dayjs(visibleMonth).subtract(1, "month").format("YYYY-MM"));
  };

  const handleNextMonth = () => {
    onMonthChange(dayjs(visibleMonth).add(1, "month").format("YYYY-MM"));
  };

  return (
    <div className="w-full mb-1 flex flex-row justify-between items-center gap-1">
      <span className="relative text-sm text-muted-foreground">
        {currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" })}
      </span>
      <div className="flex justify-end items-center shrink-0 gap-1">
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={handlePrevMonth} aria-label="Previous month">
          <ChevronLeftIcon className="w-5 h-auto shrink-0 opacity-40" />
        </button>
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={handleNextMonth} aria-label="Next month">
          <ChevronRightIcon className="w-5 h-auto shrink-0 opacity-40" />
        </button>
      </div>
    </div>
  );
};

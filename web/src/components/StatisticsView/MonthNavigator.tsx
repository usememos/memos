import dayjs from "dayjs";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
      <div className="relative text-sm inline-flex flex-row items-center w-auto gap-2 dark:text-gray-400">
        <CalendarIcon className="w-4 h-4" />
        {currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" })}
      </div>
      <div className="flex justify-end items-center shrink-0 gap-1">
        <button className="p-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={handlePrevMonth} aria-label="Previous month">
          <ChevronLeftIcon className="w-5 h-auto shrink-0 opacity-40" />
        </button>
        <button className="p-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleNextMonth} aria-label="Next month">
          <ChevronRightIcon className="w-5 h-auto shrink-0 opacity-40" />
        </button>
      </div>
    </div>
  );
};

import dayjs from "dayjs";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import DatePicker from "react-datepicker";
import i18n from "@/i18n";
import type { MonthNavigatorProps } from "@/types/statistics";
import "react-datepicker/dist/react-datepicker.css";

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
      <div className="relative text-sm font-medium inline-flex flex-row items-center w-auto dark:text-gray-400">
        <DatePicker
          selected={currentMonth}
          onChange={(date) => {
            if (date) {
              onMonthChange(dayjs(date).format("YYYY-MM"));
            }
          }}
          dateFormat="MMMM yyyy"
          showMonthYearPicker
          showFullMonthYearPicker
          customInput={
            <span className="cursor-pointer text-base hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" })}
            </span>
          }
          popperPlacement="bottom-start"
          calendarClassName="!bg-white !border-gray-200 !font-normal !shadow-lg"
        />
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

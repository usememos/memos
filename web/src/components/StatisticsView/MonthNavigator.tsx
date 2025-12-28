import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { CalendarPopover } from "@/components/ActivityCalendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import i18n from "@/i18n";
import { addMonths, formatMonth, getMonthFromDate, getYearFromDate, setYearAndMonth } from "@/lib/calendar-utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = ({ visibleMonth, onMonthChange }: MonthNavigatorProps) => {
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const currentMonth = new Date(visibleMonth);
  const currentYear = getYearFromDate(visibleMonth);
  const currentMonthNum = getMonthFromDate(visibleMonth);

  const { statistics } = useFilteredMemoStats({
    userName: currentUser?.name,
  });

  const handlePrevMonth = () => {
    onMonthChange(addMonths(visibleMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(visibleMonth, 1));
  };

  const handleDateClick = (date: string) => {
    onMonthChange(formatMonth(date));
    setIsOpen(false);
  };

  const handleYearChange = (year: number) => {
    onMonthChange(setYearAndMonth(year, currentMonthNum));
  };

  return (
    <div className="w-full mb-1 flex flex-row justify-between items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <span className="relative text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            {currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" })}
          </span>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <CalendarPopover
            selectedYear={currentYear}
            data={statistics.activityStats}
            onYearChange={handleYearChange}
            onDateClick={handleDateClick}
          />
        </PopoverContent>
      </Popover>
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

import dayjs from "dayjs";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { YearCalendar } from "@/components/ActivityCalendar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import i18n from "@/i18n";
import { addMonths, formatMonth, getMonthFromDate, getYearFromDate, setYearAndMonth } from "@/lib/calendar-utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = ({ visibleMonth, onMonthChange, activityStats }: MonthNavigatorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentMonth = dayjs(visibleMonth).toDate();
  const currentYear = getYearFromDate(visibleMonth);
  const currentMonthNum = getMonthFromDate(visibleMonth);

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
    <div className="w-full mb-2 flex flex-row justify-between items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button className="py-1 text-sm text-foreground font-medium transition-colors flex items-center select-none">
            {currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" })}
          </button>
        </DialogTrigger>
        <DialogContent
          className="p-0 border border-border/20 bg-background md:max-w-6xl w-[min(100vw-24px,1200px)] max-h-[85vh] overflow-auto rounded-2xl shadow-2xl"
          size="2xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Select Month</DialogTitle>
          <YearCalendar selectedYear={currentYear} data={activityStats} onYearChange={handleYearChange} onDateClick={handleDateClick} />
        </DialogContent>
      </Dialog>
      <div className="flex justify-end items-center shrink-0">
        <button
          className="h-8 w-8 rounded-lg hover:border-border/40 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          onClick={handlePrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-4 h-4 mx-auto" />
        </button>
        <button
          className="h-8 w-8 rounded-lg hover:border-border/40 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          onClick={handleNextMonth}
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-4 h-4 mx-auto" />
        </button>
      </div>
    </div>
  );
};

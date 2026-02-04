import dayjs from "dayjs";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { YearCalendar } from "@/components/ActivityCalendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import i18n from "@/i18n";
import { addMonths, formatMonth, getMonthFromDate, getYearFromDate, setYearAndMonth } from "@/lib/calendar-utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = memo(({ visibleMonth, onMonthChange, activityStats }: MonthNavigatorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { currentMonth, currentYear, currentMonthNum } = useMemo(
    () => ({
      currentMonth: dayjs(visibleMonth).toDate(),
      currentYear: getYearFromDate(visibleMonth),
      currentMonthNum: getMonthFromDate(visibleMonth),
    }),
    [visibleMonth],
  );

  const monthLabel = useMemo(() => currentMonth.toLocaleString(i18n.language, { year: "numeric", month: "long" }), [currentMonth]);

  const handlePrevMonth = useCallback(() => onMonthChange(addMonths(visibleMonth, -1)), [visibleMonth, onMonthChange]);
  const handleNextMonth = useCallback(() => onMonthChange(addMonths(visibleMonth, 1)), [visibleMonth, onMonthChange]);

  const handleDateClick = useCallback(
    (date: string) => {
      onMonthChange(formatMonth(date));
      setIsOpen(false);
    },
    [onMonthChange],
  );

  const handleYearChange = useCallback(
    (year: number) => onMonthChange(setYearAndMonth(year, currentMonthNum)),
    [currentMonthNum, onMonthChange],
  );

  return (
    <header className="w-full mb-2 flex items-center justify-between gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="py-0.5 text-sm text-foreground font-medium transition-colors hover:text-foreground/80 select-none"
          >
            {monthLabel}
          </button>
        </DialogTrigger>
        <DialogContent
          className="p-0 border border-border/20 bg-background md:max-w-6xl w-[min(100vw-24px,1200px)] max-h-[85vh] overflow-y-auto rounded-xl shadow-xl"
          size="2xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Select Month</DialogTitle>
          <YearCalendar selectedYear={currentYear} data={activityStats} onYearChange={handleYearChange} onDateClick={handleDateClick} />
        </DialogContent>
      </Dialog>

      <nav className="flex items-center shrink-0" aria-label="Month navigation">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevMonth}
          aria-label="Previous month"
          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          aria-label="Next month"
          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </nav>
    </header>
  );
});

MonthNavigator.displayName = "MonthNavigator";

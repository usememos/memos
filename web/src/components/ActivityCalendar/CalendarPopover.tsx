import { useMemo } from "react";
import { calculateYearMaxCount, filterDataByYear, generateMonthsForYear } from "@/components/ActivityCalendar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CalendarHeader } from "./CalendarHeader";
import { getMaxYear, MIN_YEAR } from "./constants";
import { MonthCard } from "./MonthCard";
import type { CalendarPopoverProps } from "./types";

export const CalendarPopover = ({ selectedYear, data, onYearChange, onDateClick, className }: CalendarPopoverProps) => {
  const yearData = useMemo(() => filterDataByYear(data, selectedYear), [data, selectedYear]);
  const months = useMemo(() => generateMonthsForYear(selectedYear), [selectedYear]);
  const yearMaxCount = useMemo(() => calculateYearMaxCount(yearData), [yearData]);
  const canGoPrev = selectedYear > MIN_YEAR;
  const canGoNext = selectedYear < getMaxYear();

  return (
    <div className={cn("w-full max-w-4xl flex flex-col gap-3 p-3", className)}>
      <CalendarHeader selectedYear={selectedYear} onYearChange={onYearChange} canGoPrev={canGoPrev} canGoNext={canGoNext} />

      <TooltipProvider>
        <div className="w-full animate-fade-in">
          <div className="grid gap-2 sm:gap-2.5 md:gap-3 lg:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {months.map((month) => (
              <MonthCard key={month} month={month} data={yearData} maxCount={yearMaxCount} onClick={onDateClick} />
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";
import {
  calculateYearMaxCount,
  filterDataByYear,
  generateMonthsForYear,
  getMonthLabel,
  MonthCalendar,
} from "@/components/ActivityCalendar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getMaxYear, MIN_YEAR } from "./constants";
import type { YearCalendarProps } from "./types";

export const YearCalendar = ({ selectedYear, data, onYearChange, onDateClick, className }: YearCalendarProps) => {
  const t = useTranslate();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearData = useMemo(() => filterDataByYear(data, selectedYear), [data, selectedYear]);
  const months = useMemo(() => generateMonthsForYear(selectedYear), [selectedYear]);
  const yearMaxCount = useMemo(() => calculateYearMaxCount(yearData), [yearData]);

  const canGoPrev = selectedYear > MIN_YEAR;
  const canGoNext = selectedYear < getMaxYear();
  const isCurrentYear = selectedYear === currentYear;

  const handlePrevYear = () => canGoPrev && onYearChange(selectedYear - 1);
  const handleNextYear = () => canGoNext && onYearChange(selectedYear + 1);
  const handleToday = () => onYearChange(currentYear);

  return (
    <div className={cn("w-full flex flex-col gap-6 p-2 md:p-0 select-none", className)}>
      <div className="flex items-center justify-between pb-4 px-2 pt-2">
        <h2 className="text-3xl font-bold text-foreground tracking-tight leading-none">{selectedYear}</h2>

        <div className="inline-flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevYear}
            disabled={!canGoPrev}
            aria-label="Previous year"
            className="h-9 w-9 p-0 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
            disabled={isCurrentYear}
            aria-label={t("common.today")}
            className={cn(
              "h-9 px-4 rounded-md text-sm font-medium transition-colors",
              isCurrentYear ? "bg-secondary/50 text-muted-foreground cursor-default" : "hover:bg-secondary/80 text-foreground",
            )}
          >
            {t("common.today")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextYear}
            disabled={!canGoNext}
            aria-label="Next year"
            className="h-9 w-9 p-0 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <TooltipProvider>
        <div className="w-full animate-fade-in">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {months.map((month) => (
              <div
                key={month}
                className="flex flex-col gap-3 rounded-lg p-3 hover:bg-secondary/40 transition-colors cursor-default border border-transparent hover:border-border/50"
              >
                <div className="text-xs font-bold text-foreground/80 uppercase tracking-widest pl-1">{getMonthLabel(month)}</div>
                <MonthCalendar month={month} data={yearData} maxCount={yearMaxCount} size="small" onClick={onDateClick} />
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

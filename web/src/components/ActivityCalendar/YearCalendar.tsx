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
    <div className={cn("w-full flex flex-col gap-6 px-4 sm:px-0 py-4 select-none", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight leading-none">{selectedYear}</h2>
        </div>

        <div className="inline-flex items-center gap-1 shrink-0 rounded-lg border border-border/20 bg-muted/20 p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevYear}
            disabled={!canGoPrev}
            aria-label="Previous year"
            className="h-8 w-8 p-0 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground"
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
              "h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
              isCurrentYear ? "bg-muted/30 text-muted-foreground cursor-default" : "hover:bg-muted/30 text-foreground",
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
            className="h-8 w-8 p-0 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <TooltipProvider>
        <div className="w-full animate-fade-in">
          <div className="grid gap-6 md:gap-7 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {months.map((month) => (
              <div
                key={month}
                className="flex flex-col gap-3 rounded-2xl border border-border/20 bg-muted/10 p-4 shadow-sm hover:shadow-md transition-shadow cursor-default"
              >
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.22em] pl-1">
                  {getMonthLabel(month)}
                </div>
                <MonthCalendar month={month} data={yearData} maxCount={yearMaxCount} size="small" onClick={onDateClick} />
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

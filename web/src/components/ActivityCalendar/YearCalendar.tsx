import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getMaxYear, MIN_YEAR } from "./constants";
import { MonthCalendar } from "./MonthCalendar";
import type { YearCalendarProps } from "./types";
import { calculateYearMaxCount, filterDataByYear, generateMonthsForYear, getMonthLabel } from "./utils";

interface YearNavigationProps {
  selectedYear: number;
  currentYear: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

const YearNavigation = memo(({ selectedYear, currentYear, onPrev, onNext, onToday, canGoPrev, canGoNext }: YearNavigationProps) => {
  const t = useTranslate();
  const isCurrentYear = selectedYear === currentYear;

  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-2xl font-semibold text-foreground tracking-tight">{selectedYear}</h2>

      <nav className="inline-flex items-center gap-0.5 rounded-lg border border-border/30 bg-muted/10 p-0.5" aria-label="Year navigation">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous year"
          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToday}
          disabled={isCurrentYear}
          aria-label={t("common.today")}
          className={cn(
            "h-7 px-2.5 rounded-md text-[10px] font-medium uppercase tracking-wider",
            isCurrentYear ? "text-muted-foreground/50 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          {t("common.today")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next year"
          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </nav>
    </div>
  );
});
YearNavigation.displayName = "YearNavigation";

interface MonthCardProps {
  month: string;
  data: Record<string, number>;
  maxCount: number;
  onDateClick: (date: string) => void;
}

const MonthCard = memo(({ month, data, maxCount, onDateClick }: MonthCardProps) => (
  <article className="flex flex-col gap-2 rounded-xl border border-border/20 bg-muted/5 p-3 transition-colors hover:bg-muted/10">
    <header className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-widest">{getMonthLabel(month)}</header>
    <MonthCalendar month={month} data={data} maxCount={maxCount} size="small" onClick={onDateClick} disableTooltips />
  </article>
));
MonthCard.displayName = "MonthCard";

export const YearCalendar = memo(({ selectedYear, data, onYearChange, onDateClick, className }: YearCalendarProps) => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearData = useMemo(() => filterDataByYear(data, selectedYear), [data, selectedYear]);
  const months = useMemo(() => generateMonthsForYear(selectedYear), [selectedYear]);
  const yearMaxCount = useMemo(() => calculateYearMaxCount(yearData), [yearData]);

  const canGoPrev = selectedYear > MIN_YEAR;
  const canGoNext = selectedYear < getMaxYear();

  return (
    <section className={cn("w-full flex flex-col gap-5 px-4 py-4 select-none", className)} aria-label={`Year ${selectedYear} calendar`}>
      <YearNavigation
        selectedYear={selectedYear}
        currentYear={currentYear}
        onPrev={() => canGoPrev && onYearChange(selectedYear - 1)}
        onNext={() => canGoNext && onYearChange(selectedYear + 1)}
        onToday={() => onYearChange(currentYear)}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 animate-fade-in">
        {months.map((month) => (
          <MonthCard key={month} month={month} data={yearData} maxCount={yearMaxCount} onDateClick={onDateClick} />
        ))}
      </div>
    </section>
  );
});

YearCalendar.displayName = "YearCalendar";

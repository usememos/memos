import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getMaxYear, MIN_YEAR } from "./constants";
import { MonthCalendar } from "./MonthCalendar";
import type { CalendarData, YearCalendarProps } from "./types";
import { calculateMaxCount, filterDataByYear, generateMonthsForYear, getMonthLabel } from "./utils";

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
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground/90">{selectedYear}</h2>

      <nav className="inline-flex items-center gap-1" aria-label="Year navigation">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous year"
          className="size-7 rounded-md text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronLeftIcon className="size-[15px] rtl:rotate-180" strokeWidth={1.75} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToday}
          disabled={isCurrentYear}
          aria-label={t("common.today")}
          className={cn(
            "h-7 rounded-md px-2.5 text-[11px] font-medium",
            isCurrentYear
              ? "cursor-default text-muted-foreground/40"
              : "text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90",
          )}
        >
          {t("common.today")}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next year"
          className="size-7 rounded-md text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronRightIcon className="size-[15px] rtl:rotate-180" strokeWidth={1.75} />
        </Button>
      </nav>
    </div>
  );
});
YearNavigation.displayName = "YearNavigation";

interface MonthCardProps {
  month: string;
  data: CalendarData;
  maxCount: number;
  onDateClick: (date: string) => void;
  timeBasis?: MemoTimeBasis;
}

const MonthCard = memo(({ month, data, maxCount, onDateClick, timeBasis }: MonthCardProps) => (
  <article className="flex flex-col gap-2 rounded-lg bg-muted/10 p-3 transition-colors hover:bg-muted/20">
    <header className="text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground/60">
      {getMonthLabel(month)}
    </header>
    <MonthCalendar month={month} data={data} maxCount={maxCount} size="small" onClick={onDateClick} disableTooltips timeBasis={timeBasis} />
  </article>
));
MonthCard.displayName = "MonthCard";

export const YearCalendar = memo(({ selectedYear, data, onYearChange, onDateClick, className, timeBasis }: YearCalendarProps) => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearData = useMemo(() => filterDataByYear(data, selectedYear), [data, selectedYear]);
  const months = useMemo(() => generateMonthsForYear(selectedYear), [selectedYear]);
  const yearMaxCount = useMemo(() => calculateMaxCount(yearData), [yearData]);

  const canGoPrev = selectedYear > MIN_YEAR;
  const canGoNext = selectedYear < getMaxYear();

  return (
    <section className={cn("flex w-full flex-col gap-4 px-5 py-5 select-none", className)} aria-label={`Year ${selectedYear} calendar`}>
      <YearNavigation
        selectedYear={selectedYear}
        currentYear={currentYear}
        onPrev={() => canGoPrev && onYearChange(selectedYear - 1)}
        onNext={() => canGoNext && onYearChange(selectedYear + 1)}
        onToday={() => onYearChange(currentYear)}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
      />

      <div className="grid grid-cols-1 gap-3.5 animate-fade-in sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => (
          <MonthCard key={month} month={month} data={yearData} maxCount={yearMaxCount} onDateClick={onDateClick} timeBasis={timeBasis} />
        ))}
      </div>
    </section>
  );
});

YearCalendar.displayName = "YearCalendar";

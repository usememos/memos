import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useMemo, useState } from "react";
import {
  CompactMonthCalendar,
  calculateYearMaxCount,
  filterDataByYear,
  generateMonthsForYear,
  getMonthLabel,
} from "@/components/ActivityCalendar";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDateFilterNavigation } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const MIN_YEAR = 2000;
const MAX_YEAR = new Date().getFullYear() + 1;

const Calendar = observer(() => {
  const currentUser = useCurrentUser();
  const t = useTranslate();
  const navigateToDateFilter = useDateFilterNavigation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { statistics, loading } = useFilteredMemoStats({
    userName: currentUser?.name,
  });

  const yearData = useMemo(() => filterDataByYear(statistics.activityStats, selectedYear), [statistics.activityStats, selectedYear]);

  const months = useMemo(() => generateMonthsForYear(selectedYear), [selectedYear]);

  const yearMaxCount = useMemo(() => calculateYearMaxCount(yearData), [yearData]);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const isCurrentYear = selectedYear === currentYear;

  const handlePrevYear = () => {
    if (selectedYear > MIN_YEAR) {
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleNextYear = () => {
    if (selectedYear < MAX_YEAR) {
      setSelectedYear(selectedYear + 1);
    }
  };

  const handleToday = () => {
    setSelectedYear(currentYear);
  };

  const canGoPrev = selectedYear > MIN_YEAR;
  const canGoNext = selectedYear < MAX_YEAR;

  return (
    <section className="relative w-full min-h-full flex flex-col justify-start items-center bg-background">
      <MobileHeader />
      <div className="relative w-full flex flex-col items-center px-3 sm:px-4 md:px-6 lg:px-8 pb-8">
        <div className="w-full max-w-7xl flex flex-col gap-3 sm:gap-4 py-3 sm:py-4">
          <div className="flex items-center justify-between pb-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-none">{selectedYear}</h1>

            <div className="inline-flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevYear}
                disabled={!canGoPrev}
                aria-label="Previous year"
                className="rounded-full hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon />
              </Button>

              <Button
                variant={isCurrentYear ? "secondary" : "ghost"}
                onClick={handleToday}
                disabled={isCurrentYear}
                aria-label={t("common.today")}
                className={cn(
                  "h-9 px-4 rounded-full font-medium text-sm transition-colors",
                  isCurrentYear
                    ? "bg-accent text-accent-foreground cursor-default"
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {t("common.today")}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextYear}
                disabled={!canGoNext}
                aria-label="Next year"
                className="rounded-full hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="w-full flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading calendar...</p>
              </div>
            </div>
          ) : (
            <TooltipProvider>
              <div className="w-full animate-fade-in">
                <div className="grid gap-2 sm:gap-2.5 md:gap-3 lg:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                  {months.map((month) => (
                    <div
                      key={month}
                      className="flex flex-col gap-1 sm:gap-1.5 rounded-lg border bg-card p-1.5 sm:p-2 md:p-2.5 shadow-sm hover:shadow-md hover:border-border/60 transition-all duration-200"
                    >
                      <div className="text-xs font-semibold text-foreground text-center tracking-tight">{getMonthLabel(month)}</div>
                      <CompactMonthCalendar
                        month={month}
                        data={yearData}
                        maxCount={yearMaxCount}
                        size="small"
                        onClick={navigateToDateFilter}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </section>
  );
});

export default Calendar;

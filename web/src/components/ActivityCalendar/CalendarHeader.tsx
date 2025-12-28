import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";

interface CalendarHeaderProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export const CalendarHeader = ({ selectedYear, onYearChange, canGoPrev, canGoNext }: CalendarHeaderProps) => {
  const t = useTranslate();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const isCurrentYear = selectedYear === currentYear;

  const handlePrevYear = () => {
    if (canGoPrev) {
      onYearChange(selectedYear - 1);
    }
  };

  const handleNextYear = () => {
    if (canGoNext) {
      onYearChange(selectedYear + 1);
    }
  };

  const handleToday = () => {
    onYearChange(currentYear);
  };

  return (
    <div className="flex items-center justify-between pb-2">
      <h2 className="text-2xl font-bold text-foreground tracking-tight leading-none">{selectedYear}</h2>

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
          className="bg-accent text-accent-foreground hover:bg-accent/50 text-muted-foreground hover:text-foreground h-9 px-4 rounded-full font-medium text-sm transition-colors cursor-default"
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
  );
};

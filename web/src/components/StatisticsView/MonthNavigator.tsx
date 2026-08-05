import dayjs from "dayjs";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { addMonths } from "@/lib/calendar-utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = memo(({ visibleMonth, onMonthChange }: MonthNavigatorProps) => {
  const { i18n, t } = useTranslation();
  const monthLabel = dayjs(visibleMonth).toDate().toLocaleString(i18n.language, { year: "numeric", month: "long" });
  const handlePrevMonth = () => onMonthChange(addMonths(visibleMonth, -1));
  const handleNextMonth = () => onMonthChange(addMonths(visibleMonth, 1));

  return (
    <header className="mb-1.5 flex w-full items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-[15px] font-semibold leading-7 tracking-[-0.015em] text-foreground/90 select-none">
        {monthLabel}
      </h2>

      <nav className="flex shrink-0 items-center gap-1" aria-label={t("common.month-navigation")}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handlePrevMonth}
          aria-label={t("common.previous-month")}
          className="size-7 rounded-md text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronLeftIcon className="size-[15px]" strokeWidth={1.75} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNextMonth}
          aria-label={t("common.next-month")}
          className="size-7 rounded-md text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronRightIcon className="size-[15px]" strokeWidth={1.75} />
        </Button>
      </nav>
    </header>
  );
});

MonthNavigator.displayName = "MonthNavigator";

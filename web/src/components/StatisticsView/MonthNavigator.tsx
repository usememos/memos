import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonthLabel } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = memo(({ visibleMonth, onMonthChange }: MonthNavigatorProps) => {
  const { i18n, t } = useTranslation();
  const monthLabel = formatMonthLabel(visibleMonth, i18n.language);
  const handlePrevMonth = () => onMonthChange(addMonths(visibleMonth, -1));
  const handleNextMonth = () => onMonthChange(addMonths(visibleMonth, 1));

  return (
    <header className={cn(SIDEBAR_ROW_BOX_CLASSES, "mb-1.5 justify-between")}>
      <h2 className="min-w-0 truncate font-medium tracking-[-0.015em] text-foreground/90 select-none">{monthLabel}</h2>

      <nav className="flex shrink-0 items-center gap-0.5" aria-label={t("common.month-navigation")}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handlePrevMonth}
          aria-label={t("common.previous-month")}
          className="size-6 rounded text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronLeftIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNextMonth}
          aria-label={t("common.next-month")}
          className="size-6 rounded text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground/90"
        >
          <ChevronRightIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </Button>
      </nav>
    </header>
  );
});

MonthNavigator.displayName = "MonthNavigator";

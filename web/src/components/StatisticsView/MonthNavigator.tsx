import { Button, Tooltip } from "@usememos/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { addMonths, formatMonthLabel } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import type { MonthNavigatorProps } from "@/types/statistics";

export const MonthNavigator = memo(({ visibleMonth, onMonthChange }: MonthNavigatorProps) => {
  const { i18n, t } = useTranslation();
  const monthLabel = formatMonthLabel(visibleMonth, i18n.language);
  const handlePrevMonth = () => onMonthChange(addMonths(visibleMonth, -1));
  const handleNextMonth = () => onMonthChange(addMonths(visibleMonth, 1));

  return (
    <header className={cn(SIDEBAR_ROW_BOX_CLASSES, "mb-2 justify-between")}>
      <h2 className="min-w-0 truncate mu-label text-mu-ink select-none">{monthLabel}</h2>

      <nav className="flex shrink-0 items-center gap-0.5" aria-label={t("common.month-navigation")}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={handlePrevMonth}
                aria-label={t("common.previous-month")}
                icon={<ChevronLeftIcon className="rtl:rotate-180" />}
              />
            }
          />
          <Tooltip.Popup>{t("common.previous-month")}</Tooltip.Popup>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="xs"
                onClick={handleNextMonth}
                aria-label={t("common.next-month")}
                icon={<ChevronRightIcon className="rtl:rotate-180" />}
              />
            }
          />
          <Tooltip.Popup>{t("common.next-month")}</Tooltip.Popup>
        </Tooltip.Root>
      </nav>
    </header>
  );
});

MonthNavigator.displayName = "MonthNavigator";

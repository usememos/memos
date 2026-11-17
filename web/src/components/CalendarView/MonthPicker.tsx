import { Button, buttonClasses, Popover } from "@usememos/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import { buildCalendarPath, buildMonthKey, getCalendarActivityMonths } from "./paths";

export interface MonthPickerProps {
  /** `YYYY-MM` currently shown. */
  month: string;
  monthLabel: string;
  /** `YYYY-MM-DD` */
  today: string;
  activityStats: Record<string, number>;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const TEXT_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "sm" });
// md, so the 20px heading line fits the control.
const TITLE_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "md" });

/**
 * The month title opens quick year and month navigation. Years with activity are listed,
 * and months containing entries get a dot. Month links preserve browser history behavior.
 */
export const MonthPicker = ({ month, monthLabel, today, activityStats }: MonthPickerProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const shownYear = Number(month.slice(0, 4));
  const [year, setYear] = useState(shownYear);
  const activityMonths = useMemo(() => getCalendarActivityMonths(activityStats), [activityStats]);
  const years = useMemo(
    () => [...new Set([...Object.keys(activityMonths).map(Number), shownYear, Number(today.slice(0, 4))])].sort((a, b) => a - b),
    [activityMonths, shownYear, today],
  );

  useEffect(() => {
    if (open) setYear(shownYear);
  }, [open, shownYear]);

  const monthShortLabels = useMemo(
    () => MONTHS.map((value) => new Date(2000, value - 1, 1).toLocaleString(i18n.language, { month: "short" })),
    [i18n.language],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* The month is the calendar page's title, so it is the page heading as well as the trigger. */}
      <h1 className="min-w-0">
        <Popover.Trigger aria-label={t("calendar.select-month")} className={cn(TITLE_CONTROL_CLASSES, "mu-heading text-mu-text")}>
          {monthLabel}
        </Popover.Trigger>
      </h1>
      <Popover.Popup align="start" className="w-72">
        <div className="mb-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {years.map((value) => (
            <Button
              key={value}
              variant={year === value ? "neutral" : "ghost"}
              size="sm"
              aria-pressed={year === value}
              onClick={() => setYear(value)}
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          {MONTHS.map((value) => {
            const key = buildMonthKey(year, value);
            const isShown = key === month;
            const hasActivity = activityMonths[year]?.includes(value) ?? false;
            return (
              <CalendarLink
                key={key}
                to={buildCalendarPath(key)}
                aria-current={isShown ? "page" : undefined}
                className={cn(TEXT_CONTROL_CLASSES, "relative text-mu-text")}
                onClick={() => setOpen(false)}
              >
                {monthShortLabels[value - 1]}
                {hasActivity && <span className="mu-visually-hidden">{t("calendar.has-entries")}</span>}
                {hasActivity && (
                  <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-mu-primary" />
                )}
              </CalendarLink>
            );
          })}
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
};

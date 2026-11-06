import { Button, buttonClasses, Popover } from "@usememos/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import { buildCalendarPath, buildMonthKey, getMonthOfDate } from "./paths";

export interface MonthPickerProps {
  /** `YYYY-MM` currently shown. */
  month: string;
  monthLabel: string;
  /** `YYYY-MM-DD` */
  today: string;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const TEXT_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "sm" });
// md, so the 20px heading line fits the control.
const TITLE_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "md" });

/**
 * The month title is the trigger; the popup is a year stepper over the twelve months, the
 * shown month filled (it is the `aria-current` month) and the current month marked. Months
 * are links so the browser owns history and middle-click.
 */
export const MonthPicker = ({ month, monthLabel, today }: MonthPickerProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const shownYear = Number(month.slice(0, 4));
  const [year, setYear] = useState(shownYear);
  const currentMonth = getMonthOfDate(today);

  // Reopening lands on the shown month's year, not wherever the stepper was left.
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
        <Popover.Trigger aria-label={t("calendar.select-month")} className={cn(TITLE_CONTROL_CLASSES, "mu-heading text-mu-ink")}>
          {monthLabel}
        </Popover.Trigger>
      </h1>
      <Popover.Popup align="start" className="w-60">
        <div className="mb-1 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("calendar.previous-year")}
            icon={<ChevronLeftIcon className="mu-icon rtl:rotate-180" />}
            onClick={() => setYear((value) => value - 1)}
          />
          <span className="flex-1 text-center mu-label-sm tabular-nums text-mu-ink">{year}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("calendar.next-year")}
            icon={<ChevronRightIcon className="mu-icon rtl:rotate-180" />}
            onClick={() => setYear((value) => value + 1)}
          />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          {MONTHS.map((value) => {
            const key = buildMonthKey(year, value);
            const isShown = key === month;
            const isCurrent = key === currentMonth;
            return (
              <CalendarLink
                key={key}
                to={buildCalendarPath(key)}
                aria-current={isShown ? "page" : undefined}
                className={cn(TEXT_CONTROL_CLASSES, "relative text-mu-ink")}
                onClick={() => setOpen(false)}
              >
                {monthShortLabels[value - 1]}
                {isCurrent && (
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

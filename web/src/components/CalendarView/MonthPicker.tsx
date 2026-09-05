import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/**
 * The month title is the trigger; the popup is a year stepper over the twelve months, the
 * shown month filled and the current month marked. Months are links so the browser owns
 * history and middle-click.
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("calendar.select-month")}
            className="px-3 text-base font-semibold tracking-tight"
          />
        }
      >
        {monthLabel}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-60 p-2">
        <div className="mb-1 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendar.previous-year")}
            className="size-7 text-muted-foreground/70 hover:text-foreground"
            onClick={() => setYear((value) => value - 1)}
          >
            <ChevronLeftIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
          </Button>
          <span className="flex-1 text-center text-sm font-medium tabular-nums text-foreground">{year}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendar.next-year")}
            className="size-7 text-muted-foreground/70 hover:text-foreground"
            onClick={() => setYear((value) => value + 1)}
          >
            <ChevronRightIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
          </Button>
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
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-md text-ui no-underline transition-colors",
                  isShown ? "bg-accent font-medium text-accent-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => setOpen(false)}
              >
                {monthShortLabels[value - 1]}
                {isCurrent && (
                  <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </CalendarLink>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

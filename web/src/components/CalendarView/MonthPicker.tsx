import { useDirection } from "@base-ui/react/direction-provider";
import { Button, buttonClasses, Popover, Separator } from "@usememos/ui";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react";
import { type KeyboardEvent, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type CalendarData, getTooltipText } from "@/components/ActivityCalendar";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { formatMonthLabel } from "@/lib/calendar-utils";
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
  /** Per-day memo counts in the calendar's scope and filters; they mark the months and years that hold memos. */
  counts?: CalendarData;
  timeBasis?: MemoTimeBasis;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MONTH_COLUMNS = 3;
const NO_COUNTS: CalendarData = {};

// md rows, so the mark under the current month clears its label.
const MONTH_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "md" });
const YEAR_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "sm" });
// md, so the 20px heading line fits the control.
const TITLE_CONTROL_CLASSES = buttonClasses({ variant: "ghost", size: "md" });

/** Memo counts per `YYYY-MM`, folded from the per-day statistics. */
export const countMemosByMonth = (counts: CalendarData): Map<string, number> => {
  const months = new Map<string, number>();
  for (const [date, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    const key = date.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + count);
  }
  return months;
};

/** The years that hold memos, newest first. */
export const yearsWithMemos = (months: Map<string, number>): number[] =>
  Array.from(new Set(Array.from(months.keys(), (key) => Number(key.slice(0, 4))))).sort((a, b) => b - a);

/** Centers the year in view in the rail without scrolling anything outside it. */
const revealYearInView = (rail: HTMLElement) => {
  const pressed = rail.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (pressed) rail.scrollTop = pressed.offsetTop - (rail.clientHeight - pressed.offsetHeight) / 2;
};

/**
 * The month title is the trigger, marked with the switcher glyph the Space switcher uses. The
 * popup is a year stepper over the twelve months: the shown month filled (it is the
 * `aria-current` month), the current month marked, and months that hold memos in ink while
 * empty ones recede. When memos span several years, a rail beside the months lists those years
 * so any of them is one click away; the stepper still reaches every other year. Months are links
 * so the browser owns history and middle-click.
 */
export const MonthPicker = ({ month, monthLabel, today, counts = NO_COUNTS, timeBasis }: MonthPickerProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  const direction = useDirection();
  const [open, setOpen] = useState(false);
  const shownYear = Number(month.slice(0, 4));
  const shownMonth = Number(month.slice(5, 7));
  const [year, setYear] = useState(shownYear);
  const currentMonth = getMonthOfDate(today);

  const monthCounts = useMemo(() => countMemosByMonth(counts), [counts]);
  const years = useMemo(() => yearsWithMemos(monthCounts), [monthCounts]);
  // One year of memos needs no list: the picker stays as small as it was.
  const showRail = years.length > 1;

  const monthShortLabels = useMemo(
    () => MONTHS.map((value) => new Date(2000, value - 1, 1).toLocaleString(i18n.language, { month: "short" })),
    [i18n.language],
  );

  // One tab stop each for the months and the years; arrow keys move within them.
  const monthStop = year === shownYear ? shownMonth : 1;
  const yearStop = Math.max(0, years.indexOf(year));
  const monthStopRef = useRef<HTMLAnchorElement>(null);

  // More years below the fold fade out, since the rail's scrollbar is hidden.
  const [railClipped, setRailClipped] = useState(false);
  const measureRail = (rail: HTMLElement) => setRailClipped(rail.scrollTop + rail.clientHeight < rail.scrollHeight - 1);
  // A ref keyed on the year in view (`year` only re-runs it): it runs when the popup mounts, and
  // again when the rail or the stepper moves that year, which may sit further along the rail.
  const attachRail = useCallback(
    (rail: HTMLDivElement | null) => {
      if (!rail) return;
      revealYearInView(rail);
      measureRail(rail);
    },
    [year],
  );

  const handleOpenChange = (next: boolean) => {
    // Reopening lands on the shown month's year, not wherever the stepper was left.
    if (next) setYear(shownYear);
    setOpen(next);
  };

  const handleMonthKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = Number((event.target as HTMLElement).dataset.month);
    if (!current) return;
    const step = direction === "rtl" ? -1 : 1;
    const targets: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowRight: current + step,
      ArrowUp: current - MONTH_COLUMNS,
      ArrowDown: current + MONTH_COLUMNS,
      Home: 1,
      End: MONTHS.length,
    };
    const next = targets[event.key];
    if (next === undefined || next < 1 || next > MONTHS.length) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLElement>(`[data-month="${next}"]`)?.focus();
  };

  const handleYearKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = Number((event.target as HTMLElement).dataset.yearIndex);
    if (Number.isNaN(index)) return;
    const targets: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: years.length - 1 };
    const next = targets[event.key];
    if (next === undefined || next < 0 || next >= years.length) return;
    event.preventDefault();
    event.currentTarget.querySelector<HTMLElement>(`[data-year-index="${next}"]`)?.focus();
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      {/* The month is the calendar page's title, so it is the page heading as well as the trigger;
          its name leads with the month so the heading still reads as one. */}
      <h1 className="min-w-0">
        <Popover.Trigger
          aria-label={`${monthLabel}, ${t("calendar.select-month")}`}
          className={cn(TITLE_CONTROL_CLASSES, "max-w-full mu-heading text-mu-text")}
        >
          <span className="truncate">{monthLabel}</span>
          <ChevronsUpDownIcon aria-hidden="true" className="mu-icon-sm shrink-0 text-mu-text-secondary/70" />
        </Popover.Trigger>
      </h1>
      <Popover.Popup align="start" initialFocus={monthStopRef} className={showRail ? "w-[313px]" : "w-60"}>
        <div className="flex">
          {showRail && (
            <>
              {/* The rail takes the months' height and scrolls within it, however many years there are. */}
              <div className="relative w-12 shrink-0">
                <div
                  ref={attachRail}
                  role="group"
                  className={cn(
                    "absolute inset-0 flex flex-col gap-0.5 overflow-y-auto pt-1 [scrollbar-width:none]",
                    railClipped && "[mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]",
                  )}
                  onScroll={(event) => measureRail(event.currentTarget)}
                  onKeyDown={handleYearKeyDown}
                >
                  {years.map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      data-year-index={index}
                      aria-pressed={value === year}
                      tabIndex={index === yearStop ? 0 : -1}
                      className={cn(YEAR_CONTROL_CLASSES, "shrink-0 tabular-nums text-mu-text aria-pressed:bg-mu-well")}
                      onClick={() => setYear(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mx-3 flex">
                <Separator orientation="vertical" />
              </div>
            </>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="mb-1 flex items-center">
              <Button
                variant="ghost"
                aria-label={t("calendar.previous-year")}
                icon={<ChevronLeftIcon className="mu-icon rtl:rotate-180" />}
                onClick={() => setYear((value) => value - 1)}
              />
              <span className="flex-1 text-center mu-label-sm tabular-nums text-mu-text">{year}</span>
              <Button
                variant="ghost"
                aria-label={t("calendar.next-year")}
                icon={<ChevronRightIcon className="mu-icon rtl:rotate-180" />}
                onClick={() => setYear((value) => value + 1)}
              />
            </div>
            <div className="grid grid-cols-3 gap-0.5" onKeyDown={handleMonthKeyDown}>
              {MONTHS.map((value) => {
                const key = buildMonthKey(year, value);
                const isShown = key === month;
                const isCurrent = key === currentMonth;
                const count = monthCounts.get(key) ?? 0;
                return (
                  <CalendarLink
                    key={key}
                    ref={value === monthStop ? monthStopRef : undefined}
                    to={buildCalendarPath(key)}
                    data-month={value}
                    tabIndex={value === monthStop ? 0 : -1}
                    aria-current={isShown ? "page" : undefined}
                    aria-label={getTooltipText(count, formatMonthLabel(key, i18n.language), t, timeBasis)}
                    className={cn(
                      MONTH_CONTROL_CLASSES,
                      "relative aria-[current=page]:bg-mu-well",
                      // Ink for months that hold memos; empty ones recede but stay reachable.
                      count > 0 || isShown ? "text-mu-text" : "text-mu-text-secondary",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {monthShortLabels[value - 1]}
                    {isCurrent && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-mu-primary"
                      />
                    )}
                  </CalendarLink>
                );
              })}
            </div>
          </div>
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
};

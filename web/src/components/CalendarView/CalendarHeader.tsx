import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addMonths } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import { MonthPicker } from "./MonthPicker";
import { buildCalendarPath, getMonthOfDate } from "./paths";

export interface CalendarHeaderProps {
  month: string;
  monthLabel: string;
  /** `YYYY-MM-DD` */
  today: string;
  /** `YYYY-MM-DD` of the open day, if any. */
  date?: string;
}

/**
 * Where "Today" goes: from another month it returns to this month; within this month it
 * toggles today's panel, so the button is also the quickest way to today's memos.
 */
export const getTodayPath = (month: string, date: string | undefined, today: string): string => {
  const currentMonth = getMonthOfDate(today);
  if (month !== currentMonth) return buildCalendarPath(currentMonth);
  return date === today ? buildCalendarPath(currentMonth) : buildCalendarPath(currentMonth, today);
};

const NAV_LINK_CLASSES = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "size-7 rounded-md text-muted-foreground/70 no-underline hover:bg-muted/60 hover:text-foreground",
);

export const CalendarHeader = ({ month, monthLabel, today, date }: CalendarHeaderProps) => {
  const t = useTranslate();
  const todayOpen = date === today;

  return (
    // The title's text starts on the grid's text axis (border + cell padding); the month
    // controls sit at the trailing edge so they never move as the title's width changes.
    <header className="flex h-9 shrink-0 items-center ps-px">
      <MonthPicker month={month} monthLabel={monthLabel} today={today} />
      <div className="ms-auto flex items-center gap-0.5">
        <CalendarLink to={buildCalendarPath(addMonths(month, -1))} aria-label={t("common.previous-month")} className={NAV_LINK_CLASSES}>
          <ChevronLeftIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </CalendarLink>
        <CalendarLink to={buildCalendarPath(addMonths(month, 1))} aria-label={t("common.next-month")} className={NAV_LINK_CLASSES}>
          <ChevronRightIcon className="size-4 rtl:rotate-180" strokeWidth={1.75} />
        </CalendarLink>
        <CalendarLink
          to={getTodayPath(month, date, today)}
          aria-pressed={todayOpen}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "ms-1.5 no-underline",
            todayOpen && "bg-accent text-accent-foreground",
          )}
        >
          {t("common.today")}
        </CalendarLink>
      </div>
    </header>
  );
};

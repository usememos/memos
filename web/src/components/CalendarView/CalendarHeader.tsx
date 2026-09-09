import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { addMonths } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { collectionPathForLocation } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import { MonthPicker } from "./MonthPicker";
import { buildCalendarPath, getMonthOfDate } from "./paths";

export interface CalendarHeaderProps {
  month: string;
  monthLabel: string;
  /** `YYYY-MM-DD` */
  today: string;
  /** `YYYY-MM-DD` of the day being shown, whether the URL names it or the layout defaulted to it. */
  activeDate?: string;
  /** Whether the shown day can be dismissed: a panel or sheet can, the phone's inline list cannot. */
  closable: boolean;
}

/**
 * Where "Today" goes: from another month it returns to this month; within this month it opens
 * today, and where the day can be dismissed a second press closes it again. On phones a day is
 * always shown, so Today simply keeps today selected and reads as pressed while it is.
 */
export const getTodayPath = (month: string, activeDate: string | undefined, today: string, closable: boolean): string => {
  const currentMonth = getMonthOfDate(today);
  if (month !== currentMonth) return buildCalendarPath(currentMonth);
  return closable && activeDate === today ? buildCalendarPath(currentMonth) : buildCalendarPath(currentMonth, today);
};

export const CalendarHeader = ({ month, monthLabel, today, activeDate, closable }: CalendarHeaderProps) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const todayOpen = activeDate === today;
  const iconControlClassName = cn(buttonVariants({ variant: "quiet", size: "icon-compact" }));

  return (
    // The title's text starts on the grid's text axis (border + cell padding); the month
    // controls sit at the trailing edge so they never move as the title's width changes.
    <header className="flex h-9 shrink-0 items-center ps-px">
      <MonthPicker month={month} monthLabel={monthLabel} today={today} />
      <div className="ms-auto flex items-center gap-0.5">
        <CalendarLink to={buildCalendarPath(addMonths(month, -1))} aria-label={t("common.previous-month")} className={iconControlClassName}>
          <ChevronLeftIcon className="rtl:rotate-180" strokeWidth={1.75} />
        </CalendarLink>
        <CalendarLink to={buildCalendarPath(addMonths(month, 1))} aria-label={t("common.next-month")} className={iconControlClassName}>
          <ChevronRightIcon className="rtl:rotate-180" strokeWidth={1.75} />
        </CalendarLink>
        {/* Today is a toggle, so it is a button that navigates; the search keeps the filter query.
            Its pressed state is the quiet variant's accent fill, keyed off aria-pressed. */}
        <button
          type="button"
          aria-pressed={todayOpen}
          className={cn(buttonVariants({ variant: "quiet", size: "sm" }), "ms-1.5")}
          onClick={() =>
            navigate({ pathname: collectionPathForLocation(getTodayPath(month, activeDate, today, closable), pathname), search })
          }
        >
          {t("common.today")}
        </button>
      </div>
    </header>
  );
};

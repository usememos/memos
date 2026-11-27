import { buttonClasses, Toggle } from "@usememos/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { CalendarData } from "@/components/ActivityCalendar";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { addMonths } from "@/lib/calendar-utils";
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
  /**
   * Control size, chosen by the layout's width and never by input type: the compact phone grid
   * leaves the header its full row, so it takes the default 32px controls there.
   */
  size?: "sm" | "md";
  /** Per-day memo counts in the calendar's scope and filters, for the month picker's marks. */
  counts?: CalendarData;
  timeBasis?: MemoTimeBasis;
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

export const CalendarHeader = ({ month, monthLabel, today, activeDate, closable, size = "sm", counts, timeBasis }: CalendarHeaderProps) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const todayOpen = activeDate === today;
  const iconControlClassName = buttonClasses({ variant: "ghost", size, iconOnly: true });

  return (
    // The title's text starts on the grid's text axis (the grid's border, the cell's border and
    // its padding); the month controls sit at the trailing edge so they never move as the title's
    // width changes. Below sm the cells pad less, so the title steps out to stay on their axis.
    <header className="-ms-1 flex h-9 shrink-0 items-center sm:ms-0 sm:ps-0.5">
      <MonthPicker month={month} monthLabel={monthLabel} today={today} counts={counts} timeBasis={timeBasis} />
      <div className="ms-auto flex items-center gap-1 md:gap-0.5">
        <CalendarLink to={buildCalendarPath(addMonths(month, -1))} aria-label={t("common.previous-month")} className={iconControlClassName}>
          <ChevronLeftIcon className="mu-icon rtl:rotate-180" />
        </CalendarLink>
        <CalendarLink to={buildCalendarPath(addMonths(month, 1))} aria-label={t("common.next-month")} className={iconControlClassName}>
          <ChevronRightIcon className="mu-icon rtl:rotate-180" />
        </CalendarLink>
        {/* Today stays pressed while today is the shown day, so it is a Toggle that navigates;
            the search keeps the filter query. */}
        <Toggle
          size={size}
          pressed={todayOpen}
          className="ms-1.5"
          onPressedChange={() =>
            navigate({ pathname: collectionPathForLocation(getTodayPath(month, activeDate, today, closable), pathname), search })
          }
        >
          {t("common.today")}
        </Toggle>
      </div>
    </header>
  );
};

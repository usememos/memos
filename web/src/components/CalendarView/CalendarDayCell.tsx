import { memo } from "react";
import { type CalendarDayCell as CalendarDayCellData, getTooltipText } from "@/components/ActivityCalendar";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import type { CalendarDaySummary } from "./dayModel";
import { buildCalendarPath, getMonthOfDate } from "./paths";

/** Vertical rhythm of a cell, in px; the grid derives how many rows fit from these. */
export const CELL_PADDING_Y = 16;
export const CELL_NUMBER_ROW = 24;
export const CELL_ROWS_GAP = 4;
export const CELL_ROW_HEIGHT = 18;

export interface CalendarDayCellProps {
  day: CalendarDayCellData;
  summary?: CalendarDaySummary;
  /** Memo rows the cell has room for; 0 below md, where the cell only shows a dot. */
  visibleRows: number;
  /** The month's memos are still loading; `day.count` from statistics is all we know. */
  pending: boolean;
  timeBasis: MemoTimeBasis;
  tabIndex: number;
  isLastColumn: boolean;
  isLastRow: boolean;
  /** Which rounded corner of the grid this cell occupies, so fill and focus follow it. */
  corner?: "ss" | "se" | "es" | "ee";
}

const CORNER_CLASSES = { ss: "rounded-ss-lg", se: "rounded-se-lg", es: "rounded-es-lg", ee: "rounded-ee-lg" } as const;

/**
 * One day of the month grid: the number, then one row per memo, as many as fit, and a
 * "+N more" line for the rest. A row is the memo's first line with a small thumbnail when
 * it carries an image. The whole cell is one link so its aria-label speaks for the day.
 */
export const CalendarDayCell = memo(
  ({ day, summary, visibleRows, pending, timeBasis, tabIndex, isLastColumn, isLastRow, corner }: CalendarDayCellProps) => {
    const t = useTranslate();
    const count = summary?.count ?? day.count;
    const entries = summary?.entries ?? [];
    // The "+N more" line takes a row of its own, so an overflowing day shows one fewer memo.
    const overflows = count > visibleRows;
    const shownEntries = entries.slice(0, overflows ? Math.max(visibleRows - 1, 0) : visibleRows);
    const showMore = overflows && visibleRows >= 1;
    const showSkeleton = pending && day.isCurrentMonth && day.count > 0;

    return (
      <CalendarLink
        to={buildCalendarPath(getMonthOfDate(day.date), day.date)}
        data-calendar-date={day.date}
        tabIndex={tabIndex}
        aria-label={getTooltipText(count, day.date, t, timeBasis)}
        aria-current={day.isSelected ? "page" : undefined}
        className={cn(
          "group/day relative flex min-h-14 min-w-0 flex-col overflow-hidden border-border/70 px-3 py-2 text-start no-underline transition-colors sm:min-h-20 md:min-h-[5.5rem]",
          !isLastColumn && "border-e",
          !isLastRow && "border-b",
          corner && CORNER_CLASSES[corner],
          "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring/60",
          // The open day is the place you are, so it takes the fill the sidebar gives a current row.
          day.isSelected ? "bg-accent" : day.isCurrentMonth ? "bg-card hover:bg-muted/40" : "bg-muted/25 hover:bg-muted/45",
        )}
      >
        {/* Everything in the cell starts on one axis: the number is plain text, and today's circle
            is drawn behind it, centered on the digits, so it never pushes the text. */}
        <span className="flex h-6 items-center">
          <span
            className={cn(
              "relative z-0 inline-flex h-6 items-center text-ui leading-none tabular-nums",
              day.isToday
                ? "font-medium text-primary-foreground before:absolute before:left-1/2 before:top-1/2 before:-z-10 before:size-[22px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']"
                : !day.isCurrentMonth
                  ? "text-muted-foreground/40"
                  : count > 0
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/60",
            )}
          >
            {day.label}
          </span>
        </span>

        {showSkeleton && <span aria-hidden="true" className="mt-1.5 hidden h-2 w-2/3 animate-pulse rounded bg-muted md:block" />}

        {day.isCurrentMonth && (shownEntries.length > 0 || showMore) && (
          <ul className="mt-1 flex min-w-0 flex-col">
            {shownEntries.map((entry) => (
              <li key={entry.memoName} className="flex h-4.5 min-w-0 items-center gap-1.5 text-xs leading-4 text-foreground/75">
                {entry.thumbnailUrl && (
                  <img
                    src={entry.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-3.5 shrink-0 rounded-[3px] object-cover"
                    // A thumbnail the server cannot produce must not leave a blank box in front of the text.
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{entry.text}</span>
              </li>
            ))}
            {showMore && (
              <li className="flex h-4.5 items-center text-xs leading-4 text-muted-foreground/70">
                {t("calendar.more-memos", { count: count - shownEntries.length })}
              </li>
            )}
          </ul>
        )}

        {count > 0 && (
          <span aria-hidden="true" className={cn("mt-1 size-1.5 rounded-full bg-primary/70", day.isCurrentMonth && "md:hidden")} />
        )}
      </CalendarLink>
    );
  },
);

CalendarDayCell.displayName = "CalendarDayCell";

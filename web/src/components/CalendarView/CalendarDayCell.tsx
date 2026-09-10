import { memo, useState } from "react";
import { type CalendarDayCell as CalendarDayCellData, getTooltipText } from "@/components/ActivityCalendar";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import type { CalendarDaySummary } from "./dayModel";
import { buildCalendarPath, getMonthOfDate } from "./paths";

export interface CalendarCellLayout {
  compact: boolean;
  textLines: number;
  imageHeight: number;
  imageCount: number;
}

/** Use the actual cell size, including width lost to the resizable day panel. */
export const layoutForCellSize = (width: number, height: number): CalendarCellLayout => {
  const available = Math.max(0, height - 48);
  return {
    compact: width < 100,
    textLines: width < 100 ? 0 : Math.min(3, Math.floor(available / 18)),
    imageHeight: width < 100 || available < 32 ? 0 : available,
    imageCount: width < 150 ? 1 : 2,
  };
};

export interface CalendarDayCellProps {
  day: CalendarDayCellData;
  summary?: CalendarDaySummary;
  layout: CalendarCellLayout;
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

/** One day, one excerpt, and supporting photos. The entire cell opens the day's memo stream. */
export const CalendarDayCell = memo(
  ({ day, summary, layout, pending, timeBasis, tabIndex, isLastColumn, isLastRow, corner }: CalendarDayCellProps) => {
    const t = useTranslate();
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const count = summary ? summary.memos.length : day.count;
    const excerpt = summary?.excerpt;
    const images = (summary?.images ?? []).filter((image) => !failedImages.includes(image.thumbnailUrl)).slice(0, layout.imageCount);
    // Keep a usable image even when a short cell cannot also fit the excerpt.
    // Text uses the space above the 32px image and 8px gap; flex gives photos any unused space.
    const showImages = images.length > 0 && layout.imageHeight >= 32;
    const textLines = showImages && excerpt ? Math.max(0, Math.min(2, Math.floor((layout.imageHeight - 40) / 18))) : layout.textLines;
    const showSkeleton = pending && !summary && day.isCurrentMonth && day.count > 0;

    return (
      <CalendarLink
        to={buildCalendarPath(getMonthOfDate(day.date), day.date)}
        data-calendar-date={day.date}
        tabIndex={tabIndex}
        aria-label={getTooltipText(count, day.date, t, timeBasis)}
        aria-current={day.isSelected ? "page" : undefined}
        className={cn(
          "group/day relative flex min-h-14 min-w-0 flex-col overflow-hidden border-border/70 px-1.5 py-2 sm:px-3 text-start no-underline transition-colors sm:min-h-20 md:min-h-[5.5rem]",
          !isLastColumn && "border-e",
          !isLastRow && "border-b",
          corner && CORNER_CLASSES[corner],
          FOCUS_VISIBLE_OUTLINE_CLASSES,
          // The open day is the place you are, so it takes the fill the sidebar gives a current row.
          day.isSelected ? "bg-accent" : day.isCurrentMonth ? "bg-card hover:bg-muted/40" : "bg-muted/25 hover:bg-muted/45",
        )}
      >
        {/* A fixed date slot keeps today's circle inside the cell, including on narrow screens. */}
        <span className={cn("flex min-h-6 gap-1", layout.compact ? "flex-col items-start" : "items-center justify-between")}>
          <span
            className={cn(
              "relative z-0 inline-flex size-6 shrink-0 items-center justify-center text-ui font-medium leading-none tabular-nums",
              day.isToday
                ? "font-medium text-primary-foreground before:absolute before:left-1/2 before:top-1/2 before:-z-10 before:size-[22px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']"
                : !day.isCurrentMonth
                  ? "text-muted-foreground/40"
                  : count > 0
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
            )}
          >
            {day.label}
          </span>
          {count > 0 && (
            <span
              className={cn(
                "min-w-0 max-w-full whitespace-nowrap text-[10px] font-normal leading-4 tabular-nums sm:text-2xs",
                layout.compact && "w-6 text-center",
                day.isCurrentMonth ? "text-muted-foreground" : "text-muted-foreground/40",
              )}
            >
              {count}
            </span>
          )}
        </span>

        {showSkeleton && layout.textLines > 0 && <span aria-hidden="true" className="mt-2 h-2 w-2/3 animate-pulse rounded bg-muted" />}

        {day.isCurrentMonth && !showSkeleton && ((excerpt && textLines > 0) || showImages) && (
          <span
            aria-hidden="true"
            className="mt-1 flex min-h-0 min-w-0 flex-col gap-2"
            style={{ height: showImages ? layout.imageHeight : undefined }}
          >
            {excerpt && textLines > 0 && (
              <span
                className={cn(
                  "shrink-0 overflow-hidden whitespace-pre-line break-words text-xs leading-[18px] text-foreground/80 [display:-webkit-box] [-webkit-box-orient:vertical]",
                  excerpt.isCode && "font-mono",
                )}
                style={{ WebkitLineClamp: textLines }}
              >
                {excerpt.text}
              </span>
            )}
            {showImages && (
              <span className="flex max-h-16 min-h-8 min-w-0 flex-1 gap-1">
                {images.map((image) => (
                  <img
                    key={image.thumbnailUrl}
                    src={image.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full min-w-0 flex-1 rounded object-cover"
                    style={{ maxWidth: images.length === 1 ? 112 : undefined }}
                    onError={() => setFailedImages((failed) => [...failed, image.thumbnailUrl])}
                  />
                ))}
              </span>
            )}
          </span>
        )}
      </CalendarLink>
    );
  },
);

CalendarDayCell.displayName = "CalendarDayCell";

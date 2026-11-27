import { Skeleton } from "@usememos/ui";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type CalendarDayCell as CalendarDayCellData,
  DAY_CELL_FILLS,
  getActivityLevel,
  getTooltipText,
} from "@/components/ActivityCalendar";
import UserAvatar from "@/components/UserAvatar";
import { useResolvedUser, useResolvedUsersByNames } from "@/contexts/MentionResolutionContext";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { formatDayLabel } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import type { CalendarDayExcerpt, CalendarDayImage, CalendarDaySummary } from "./dayModel";
import { buildCalendarPath, getMonthOfDate } from "./paths";

/** Every row is one sidebar row of type: 13px on an 18px line. */
const LINE_HEIGHT = 18;
/** The photo strip is a row of square marks, sized like a small sidebar avatar. */
const IMAGE_SIZE = 36;
const IMAGE_GAP = 4;
/** Vertical space the date line and paddings take before any preview can start. */
const HEADER_HEIGHT = 48;
const HORIZONTAL_PADDING = 24;
/** The width a full preview needs; from xl the day panel yields so columns keep it while a day is open. */
export const PREVIEW_MIN_CELL_WIDTH = 100;
/** Narrower cells, which only a wide sidebar beside the open panel produces, get a mark instead of a preview. */
const SLIM_MIN_CELL_WIDTH = 64;

export interface CalendarCellLayout {
  /** Lines that fit under the date when the day has no photo strip; a day with several memos gives each one. */
  rows: number;
  /** Lines that fit above the photo strip; can be 0 while the strip still fits. */
  rowsWithImages: number;
  /** How many of those lines a day's only memo may run over. */
  textLines: number;
  /** The same above the photo strip. */
  textLinesWithImages: number;
  /** Photo marks that fit across; 0 when the cell is too narrow or short for a strip. */
  imageCount: number;
  /** Below preview width: tighter padding, a shorter excerpt and one photo, rather than no preview. */
  slim: boolean;
  /** No preview fits (phones, or under slim width): a single mark under the date says what the day holds. */
  mark: boolean;
}

/** Use the actual cell size, including width lost to the resizable day panel. */
export const layoutForCellSize = (width: number, height: number): CalendarCellLayout => {
  // Too narrow for any preview: a mark under the date carries the day.
  const compact = width < SLIM_MIN_CELL_WIDTH;
  const slim = !compact && width < PREVIEW_MIN_CELL_WIDTH;
  const available = Math.max(0, height - HEADER_HEIGHT);
  const showImages = !compact && available >= IMAGE_SIZE;
  const mark = compact || (!showImages && available < LINE_HEIGHT);
  const rows = compact ? 0 : Math.floor(available / LINE_HEIGHT);
  const rowsWithImages = showImages ? Math.max(0, Math.floor((available - IMAGE_SIZE - IMAGE_GAP) / LINE_HEIGHT)) : 0;
  return {
    rows,
    rowsWithImages,
    textLines: Math.min(slim ? 2 : 3, rows),
    textLinesWithImages: Math.min(slim ? 1 : 2, rowsWithImages),
    imageCount: !showImages
      ? 0
      : slim
        ? 1
        : Math.min(3, Math.max(1, Math.floor((width - HORIZONTAL_PADDING + IMAGE_GAP) / (IMAGE_SIZE + IMAGE_GAP)))),
    slim,
    mark,
  };
};

/**
 * How a day with several memos spends its lines: one memo each, and when they do not all fit,
 * or a blurred tag hides some, the last line counts the rest. A single line goes to the first
 * memo rather than to a count.
 */
export const planDayRows = (excerptCount: number, hiddenCount: number, lines: number): { shown: number; more: number } => {
  if (lines <= 0 || excerptCount === 0) return { shown: 0, more: 0 };
  if (excerptCount + (hiddenCount > 0 ? 1 : 0) <= lines) return { shown: excerptCount, more: hiddenCount };
  if (lines === 1) return { shown: 1, more: 0 };
  return { shown: lines - 1, more: excerptCount - (lines - 1) + hiddenCount };
};

export interface CalendarDayCellProps {
  day: CalendarDayCellData;
  summary?: CalendarDaySummary;
  /** Busiest day in the statistics; the cell's fill is the quarter of it this day reaches. */
  maxCount: number;
  layout: CalendarCellLayout;
  /** The month's memos are still loading; `day.count` from statistics is all we know. */
  pending: boolean;
  timeBasis: MemoTimeBasis;
  /** Several creators share the grid, so each row leads with its author's avatar. */
  showAuthor: boolean;
  tabIndex: number;
  isLastColumn: boolean;
  isLastRow: boolean;
  /** Which rounded corner of the grid this cell occupies, so fill and focus follow it. */
  corner?: "ss" | "se" | "es" | "ee";
}

const CORNER_CLASSES = { ss: "rounded-ss-mu-lg", se: "rounded-se-mu-lg", es: "rounded-es-mu-lg", ee: "rounded-ee-mu-lg" } as const;

/**
 * Today and the open day share one object, the way Notion Calendar marks dates: a 22px
 * rounded-square badge on the numeral, starting on the text axis. Today is the solid
 * primary fill, the open day a quiet foreground wash, and when today is open the primary
 * badge sits inside a grey halo rather than stacking a second shape.
 */
const BADGE = "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-mu-md px-[5px]";
const TODAY_BADGE = `${BADGE} bg-mu-primary text-mu-on-primary`;
const OPEN_BADGE = `${BADGE} bg-mu-text/10 text-mu-text`;
/** Negative margin keeps the badge where it was; only the halo grows outward. */
const OPEN_TODAY_HALO = "-m-[3px] inline-flex rounded-[9px] bg-mu-text/10 p-[3px]";

const getNumeralClass = (day: CalendarDayCellData, count: number): string => {
  if (day.isToday) return TODAY_BADGE;
  if (day.isSelected) return OPEN_BADGE;
  if (!day.isCurrentMonth) return "text-mu-text-secondary/40";
  return count > 0 ? "text-mu-text" : "text-mu-text-secondary";
};

const NO_IMAGES: CalendarDaySummary["images"] = [];
const NO_EXCERPTS: CalendarDayExcerpt[] = [];
const NO_CREATORS: string[] = [];
/**
 * The mark that tells one memo from the next: a 4px dot hung in the cell's own padding, so a
 * row's text stays on the date's axis and the dot costs no height. It takes the row's ink.
 */
const ROW_DOT =
  "before:absolute before:top-[7px] before:size-1 before:rounded-full before:bg-current before:opacity-45 before:content-['']";
const ROW_INK = "text-mu-text-secondary transition-colors group-hover/day:text-mu-text";

/** Inline, so the avatar sits on the row's first line and a clamp still counts lines. */
const RowAuthor = ({ creator }: { creator: string }) => {
  const author = useResolvedUser(creator, { enabled: true });
  return (
    <UserAvatar
      className="me-1.5 inline-flex size-3.5 align-[-2px]"
      avatarUrl={author?.avatarUrl}
      name={author?.displayName || author?.username}
    />
  );
};
/** Two 14px avatars side by side fit the narrowest phone column. */
const MARK_AUTHORS = 2;

/**
 * What a cell too small for a preview shows under its date, in order: the day's first photo;
 * else who wrote, when several creators share the grid; else a glyph of written lines. The
 * heat tint still carries how much.
 */
const DayMark = ({
  photo,
  authorNames,
  onImageError,
}: {
  photo?: CalendarDayImage;
  /** Empty in a single creator's scope, or when the photo already marks the day. */
  authorNames: string[];
  onImageError: (url: string) => void;
}) => {
  const authors = useResolvedUsersByNames(authorNames);
  if (photo) {
    return (
      <img
        src={photo.thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-4 shrink-0 rounded-[3px] object-cover"
        onError={() => onImageError(photo.thumbnailUrl)}
      />
    );
  }
  if (authorNames.length > 0) {
    return (
      <span className="flex gap-0.5">
        {authorNames.map((name) => {
          const user = authors.get(name);
          return <UserAvatar key={name} className="size-3.5" avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} />;
        })}
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-[3px] text-mu-text-secondary/45 transition-colors group-hover/day:text-mu-text-secondary">
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-2.5 rounded-full bg-current" />
    </span>
  );
};

/**
 * One day: a row per memo, and a strip of photos; a single mark when the cell is too small for
 * them. A row is the memo's first line, except that a day's only memo runs on for a few. The
 * entire cell opens the day's memo stream.
 *
 * The cell borrows the sidebar's row grammar: the date and every row are 13px type on the
 * column's text axis, weight is reserved for the open day, and idle text is muted and lifts
 * to the foreground under the pointer.
 */
export const CalendarDayCell = memo(
  ({ day, summary, maxCount, layout, pending, timeBasis, showAuthor, tabIndex, isLastColumn, isLastRow, corner }: CalendarDayCellProps) => {
    const t = useTranslate();
    const { i18n } = useTranslation();
    // Read aloud as a date, not as the ISO key the grid navigates by.
    const dateLabel = useMemo(() => formatDayLabel(day.date, i18n.language), [day.date, i18n.language]);
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const count = summary ? summary.memos.length : day.count;
    const level = getActivityLevel(count, maxCount);
    const images =
      layout.imageCount > 0
        ? (summary?.images ?? NO_IMAGES).filter((image) => !failedImages.includes(image.thumbnailUrl)).slice(0, layout.imageCount)
        : NO_IMAGES;
    // Keep a usable photo even when a short cell cannot also fit the rows.
    const showImages = images.length > 0;
    const excerpts = summary?.excerpts ?? NO_EXCERPTS;
    const hiddenCount = summary?.hiddenCount ?? 0;
    // A day's only memo keeps a short excerpt; among several, each gets its first line.
    const lone = excerpts.length === 1 && hiddenCount === 0;
    const loneLines = showImages ? layout.textLinesWithImages : layout.textLines;
    const { shown, more } = lone
      ? { shown: loneLines > 0 ? 1 : 0, more: 0 }
      : planDayRows(excerpts.length, hiddenCount, showImages ? layout.rowsWithImages : layout.rows);
    const rows = excerpts.slice(0, shown);
    // An author's avatar is mark enough; in a slim column the dot follows the narrower padding in.
    const rowDot = showAuthor ? undefined : cn(ROW_DOT, layout.slim ? "before:-start-1.5" : "before:-start-2");
    // A photo that failed to load gives way to the next mark rather than an empty square.
    const markPhoto = layout.mark ? summary?.images.find((image) => !failedImages.includes(image.thumbnailUrl)) : undefined;
    const showSkeleton = pending && !summary && day.isCurrentMonth && day.count > 0;
    const numeral = <span className={cn("mu-caption tabular-nums", getNumeralClass(day, count))}>{day.label}</span>;

    return (
      <CalendarLink
        to={buildCalendarPath(getMonthOfDate(day.date), day.date)}
        data-calendar-date={day.date}
        tabIndex={tabIndex}
        aria-label={getTooltipText(count, dateLabel, t, timeBasis)}
        aria-current={day.isSelected ? "page" : undefined}
        className={cn(
          "group/day relative flex min-h-14 min-w-0 flex-col overflow-hidden px-1.5 py-2 text-start no-underline transition-colors sm:px-3 sm:min-h-20 md:min-h-[5.5rem]",
          layout.slim && "sm:px-2",
          // The mark sits a step below the date so the open day's halo clears it; the row keeps its height.
          layout.mark && "py-1.5",
          corner && CORNER_CLASSES[corner],
          "border border-mu-line/70 border-s-transparent border-t-transparent mu-focus focus-visible:border-mu-focus",
          // After the all-sides color: tailwind-merge drops a per-side color that comes before it.
          isLastColumn && "border-e-transparent",
          isLastRow && "border-b-transparent",
          // The open day keeps its heat tint; its numeral badge is the selection mark.
          day.isCurrentMonth ? DAY_CELL_FILLS[level] : "bg-mu-well/25 hover:bg-mu-hover",
        )}
      >
        {/* The date starts on the text axis like every line below it. */}
        <span className="flex h-6 shrink-0 items-center">
          {day.isSelected && day.isToday ? <span className={OPEN_TODAY_HALO}>{numeral}</span> : numeral}
        </span>

        {showSkeleton && layout.textLines > 0 && (
          <span aria-hidden="true" className="mt-1 flex h-[18px] items-center">
            <Skeleton width="66%" height={8} />
          </span>
        )}

        {layout.mark && day.isCurrentMonth && !showSkeleton && summary && (
          <span aria-hidden="true" className="mt-1 flex h-4 shrink-0 items-center">
            <DayMark
              photo={markPhoto}
              authorNames={showAuthor && !markPhoto ? summary.creators.slice(0, MARK_AUTHORS) : NO_CREATORS}
              onImageError={(url) => setFailedImages((failed) => [...failed, url])}
            />
          </span>
        )}

        {day.isCurrentMonth && !showSkeleton && (rows.length > 0 || showImages) && (
          <span aria-hidden="true" className="mt-1 flex min-w-0 flex-col gap-1">
            {rows.length > 0 && (
              <span className={cn("flex min-w-0 flex-col", ROW_INK, day.isSelected && "text-mu-text")}>
                {rows.map((excerpt) => (
                  // The dot hangs outside the row, so the row cannot clip; its text does.
                  <span key={excerpt.memoName} className={cn("relative min-w-0", rowDot)}>
                    <span
                      className={cn(
                        "mu-caption",
                        lone
                          ? "overflow-hidden whitespace-pre-line break-words [display:-webkit-box] [-webkit-box-orient:vertical]"
                          : "block truncate",
                        excerpt.isCode && "font-mono",
                      )}
                      style={lone ? { WebkitLineClamp: loneLines } : undefined}
                    >
                      {showAuthor && <RowAuthor creator={excerpt.creator} />}
                      {lone ? excerpt.text : excerpt.text.split("\n", 1)[0]}
                    </span>
                  </span>
                ))}
                {more > 0 && <span className="truncate mu-caption tabular-nums">{t("calendar.more-memos", { count: more })}</span>}
              </span>
            )}
            {showImages && (
              <span className="flex gap-1">
                {images.map((image) => (
                  <img
                    key={image.thumbnailUrl}
                    src={image.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-9 shrink-0 rounded-mu-md object-cover"
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

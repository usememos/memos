import { memo, useState } from "react";
import {
  type CalendarDayCell as CalendarDayCellData,
  DAY_CELL_FILLS,
  getActivityLevel,
  getTooltipText,
} from "@/components/ActivityCalendar";
import { useResolvedUser, useResolvedUsersByNames } from "@/components/MemoContent/MentionResolutionContext";
import UserAvatar from "@/components/UserAvatar";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { CalendarLink } from "./CalendarLink";
import type { CalendarDayImage, CalendarDaySummary } from "./dayModel";
import { buildCalendarPath, getMonthOfDate } from "./paths";

/** Every excerpt line is one sidebar row of type: 13px on an 18px line. */
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
  /** Excerpt lines when the day has no photo strip. */
  textLines: number;
  /** Excerpt lines above the photo strip; can be 0 while the strip still fits. */
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
  return {
    textLines: compact ? 0 : Math.min(slim ? 2 : 3, Math.floor(available / LINE_HEIGHT)),
    textLinesWithImages: showImages ? Math.min(slim ? 1 : 2, Math.floor((available - IMAGE_SIZE - IMAGE_GAP) / LINE_HEIGHT)) : 0,
    imageCount: !showImages
      ? 0
      : slim
        ? 1
        : Math.min(3, Math.max(1, Math.floor((width - HORIZONTAL_PADDING + IMAGE_GAP) / (IMAGE_SIZE + IMAGE_GAP)))),
    slim,
    mark,
  };
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
  /** Several creators share the grid, so each excerpt leads with its author's avatar. */
  showAuthor: boolean;
  tabIndex: number;
  isLastColumn: boolean;
  isLastRow: boolean;
  /** Which rounded corner of the grid this cell occupies, so fill and focus follow it. */
  corner?: "ss" | "se" | "es" | "ee";
}

const CORNER_CLASSES = { ss: "rounded-ss-lg", se: "rounded-se-lg", es: "rounded-es-lg", ee: "rounded-ee-lg" } as const;

/**
 * Today and the open day share one object, the way Notion Calendar marks dates: a 22px
 * rounded-square badge on the numeral, starting on the text axis. Today is the solid
 * primary fill, the open day a quiet foreground wash, and when today is open the primary
 * badge sits inside a grey halo rather than stacking a second shape.
 */
const BADGE = "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md px-[5px]";
const TODAY_BADGE = `${BADGE} bg-primary text-primary-foreground`;
const OPEN_BADGE = `${BADGE} bg-foreground/10 text-foreground`;
/** Negative margin keeps the badge where it was; only the halo grows outward. */
const OPEN_TODAY_HALO = "-m-[3px] inline-flex rounded-[9px] bg-foreground/10 p-[3px]";

const getNumeralClass = (day: CalendarDayCellData, count: number): string => {
  if (day.isToday) return TODAY_BADGE;
  if (day.isSelected) return OPEN_BADGE;
  if (!day.isCurrentMonth) return "text-muted-foreground/40";
  return count > 0 ? "text-foreground" : "text-muted-foreground/70";
};

const NO_IMAGES: CalendarDaySummary["images"] = [];
const NO_CREATORS: string[] = [];
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
    <span className="flex flex-col gap-[3px] text-muted-foreground/45 transition-colors group-hover/day:text-muted-foreground">
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-2.5 rounded-full bg-current" />
    </span>
  );
};

/**
 * One day, one excerpt, and a strip of photos; a single mark when the cell is too small for
 * them. The entire cell opens the day's memo stream.
 *
 * The cell borrows the sidebar's row grammar: the date and every excerpt line are 13px type
 * on the column's text axis, weight is reserved for the open day, and idle text is muted
 * and lifts to the foreground under the pointer.
 */
export const CalendarDayCell = memo(
  ({ day, summary, maxCount, layout, pending, timeBasis, showAuthor, tabIndex, isLastColumn, isLastRow, corner }: CalendarDayCellProps) => {
    const t = useTranslate();
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const count = summary ? summary.memos.length : day.count;
    const level = getActivityLevel(count, maxCount);
    const images =
      layout.imageCount > 0
        ? (summary?.images ?? NO_IMAGES).filter((image) => !failedImages.includes(image.thumbnailUrl)).slice(0, layout.imageCount)
        : NO_IMAGES;
    // Keep a usable photo even when a short cell cannot also fit the excerpt.
    const showImages = images.length > 0;
    const textLines = showImages ? layout.textLinesWithImages : layout.textLines;
    const excerpt = textLines > 0 ? summary?.excerpt : undefined;
    // A photo that failed to load gives way to the next mark rather than an empty square.
    const markPhoto = layout.mark ? summary?.images.find((image) => !failedImages.includes(image.thumbnailUrl)) : undefined;
    const author = useResolvedUser(excerpt?.creator ?? "", { enabled: showAuthor && Boolean(excerpt) });
    const showSkeleton = pending && !summary && day.isCurrentMonth && day.count > 0;
    const numeral = (
      <span
        className={cn(
          "text-ui leading-none tabular-nums tracking-[-0.01em]",
          day.isSelected ? "font-medium" : "font-normal",
          getNumeralClass(day, count),
        )}
      >
        {day.label}
      </span>
    );

    return (
      <CalendarLink
        to={buildCalendarPath(getMonthOfDate(day.date), day.date)}
        data-calendar-date={day.date}
        tabIndex={tabIndex}
        aria-label={getTooltipText(count, day.date, t, timeBasis)}
        aria-current={day.isSelected ? "page" : undefined}
        className={cn(
          "group/day relative flex min-h-14 min-w-0 flex-col overflow-hidden border-border/70 px-1.5 py-2 text-start no-underline transition-colors sm:px-3 sm:min-h-20 md:min-h-[5.5rem]",
          layout.slim && "sm:px-2",
          !isLastColumn && "border-e",
          !isLastRow && "border-b",
          corner && CORNER_CLASSES[corner],
          FOCUS_VISIBLE_OUTLINE_CLASSES,
          // The open day keeps its heat tint; its numeral badge is the selection mark.
          day.isCurrentMonth ? DAY_CELL_FILLS[level] : "bg-muted/25 hover:bg-muted/45",
        )}
      >
        {/* The date starts on the text axis like every line below it. */}
        <span className="flex h-6 shrink-0 items-center">
          {day.isSelected && day.isToday ? <span className={OPEN_TODAY_HALO}>{numeral}</span> : numeral}
        </span>

        {showSkeleton && layout.textLines > 0 && (
          <span aria-hidden="true" className="mt-1 flex h-[18px] items-center">
            <span className="h-2 w-2/3 animate-pulse rounded-sm bg-muted" />
          </span>
        )}

        {layout.mark && day.isCurrentMonth && !showSkeleton && summary && (
          <span aria-hidden="true" className="flex h-4 shrink-0 items-center">
            <DayMark
              photo={markPhoto}
              authorNames={showAuthor && !markPhoto ? summary.creators.slice(0, MARK_AUTHORS) : NO_CREATORS}
              onImageError={(url) => setFailedImages((failed) => [...failed, url])}
            />
          </span>
        )}

        {day.isCurrentMonth && !showSkeleton && (excerpt || showImages) && (
          <span aria-hidden="true" className="mt-1 flex min-w-0 flex-col gap-1">
            {excerpt && (
              <span
                className={cn(
                  "overflow-hidden whitespace-pre-line break-words text-ui leading-[18px] [display:-webkit-box] [-webkit-box-orient:vertical]",
                  "text-muted-foreground transition-colors group-hover/day:text-foreground",
                  day.isSelected && "text-foreground",
                  excerpt.isCode && "font-mono text-xs",
                )}
                style={{ WebkitLineClamp: textLines }}
              >
                {/* Inline, so the avatar sits on the first line and the clamp still counts lines. */}
                {showAuthor && (
                  <UserAvatar
                    className="me-1.5 inline-flex size-3.5 align-[-2px]"
                    avatarUrl={author?.avatarUrl}
                    name={author?.displayName || author?.username}
                  />
                )}
                {excerpt.text}
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
                    className="size-9 shrink-0 rounded-md object-cover"
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

import dayjs from "dayjs";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { getMemoSortTime } from "@/hooks/useMemoSorting";
import { ISO_DATE_FORMAT } from "@/lib/calendar-utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentThumbnailUrl, isImage } from "@/utils/attachment";

/** Rows a day keeps for the grid; a cell shows as many as fit and folds the rest into "+N more". */
export const MAX_DAY_ENTRIES = 8;

export interface CalendarDayEntry {
  memoName: string;
  /** First non-empty line of the memo, plain text. */
  text: string;
  /** Thumbnail of the memo's first image, when it has one. */
  thumbnailUrl?: string;
}

export interface CalendarDaySummary {
  /** Every memo of the day, including ones that yield no entry. */
  count: number;
  /** Memos in time order, capped at MAX_DAY_ENTRIES. */
  entries: CalendarDayEntry[];
}

/** Day summaries keyed by ISO date (`YYYY-MM-DD`). Days without memos are absent. */
export type CalendarMonthModel = Record<string, CalendarDaySummary>;

export interface BuildCalendarMonthModelOptions {
  /** Memos that must stay hidden in the grid (blurred tags): they count, but yield no entry. */
  isRedacted?: (memo: Memo) => boolean;
}

const firstLine = (text: string): string => {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
};

/**
 * Fold a month's memos into one summary per day. Memos are walked in ascending time so the
 * rows read as the day unfolded, whatever order the API returned them in.
 */
export const buildCalendarMonthModel = (
  memos: Memo[],
  timeBasis: MemoTimeBasis,
  { isRedacted }: BuildCalendarMonthModelOptions = {},
): CalendarMonthModel => {
  const dated = memos
    .map((memo) => ({ memo, time: getMemoSortTime(memo, timeBasis) }))
    .filter((entry): entry is { memo: Memo; time: Date } => entry.time !== undefined)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const model: CalendarMonthModel = {};
  for (const { memo, time } of dated) {
    const date = dayjs(time).format(ISO_DATE_FORMAT);
    const summary = (model[date] ??= { count: 0, entries: [] });
    summary.count += 1;
    if (isRedacted?.(memo) || summary.entries.length >= MAX_DAY_ENTRIES) continue;

    const image = memo.attachments.find((attachment) => isImage(attachment.type));
    const text = firstLine(memo.snippet || memo.content);
    if (!text && !image) continue;
    summary.entries.push({
      memoName: memo.name,
      text,
      thumbnailUrl: image ? getAttachmentThumbnailUrl(image) : undefined,
    });
  }
  return model;
};

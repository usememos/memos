import dayjs from "dayjs";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { combineCELFilters } from "@/lib/cel-filter";

export const MONTH_DATE_FORMAT = "YYYY-MM" as const;
export const ISO_DATE_FORMAT = "YYYY-MM-DD" as const;

export const getToday = (): string => dayjs().format(ISO_DATE_FORMAT);
export const getCurrentMonth = (): string => dayjs().format(MONTH_DATE_FORMAT);

export const addMonths = (date: Date | string, count: number): string => {
  return dayjs(date).add(count, "month").format(MONTH_DATE_FORMAT);
};

/** "August 2026" for `YYYY-MM`, in the viewer's language. */
export const formatMonthLabel = (month: string, locale: string): string =>
  dayjs(month).toDate().toLocaleString(locale, { year: "numeric", month: "long" });

/**
 * The local midnight named by `YYYY-MM-DD`, or undefined for anything else — including
 * dates JS would silently roll forward (2026-02-30 → March 2).
 */
export const parseLocalDate = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return undefined;
  return candidate;
};

/** A half-open `[start, end)` window in epoch seconds, in the viewer's local time zone. */
export interface LocalTimestampRange {
  startTimestamp: number;
  endTimestamp: number;
}

const toRange = (start: Date, end: Date): LocalTimestampRange => ({
  startTimestamp: Math.floor(start.getTime() / 1000),
  endTimestamp: Math.floor(end.getTime() / 1000),
});

/** The local calendar day named by `YYYY-MM-DD`, or undefined for an invalid date. */
export const getLocalDayTimestampRange = (value: string): LocalTimestampRange | undefined => {
  const start = parseLocalDate(value);
  if (!start) return undefined;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return toRange(start, end);
};

/** The local calendar month named by `YYYY-MM`, or undefined for an invalid month. */
export const getLocalMonthTimestampRange = (value: string): LocalTimestampRange | undefined => {
  const start = parseLocalDate(`${value}-01`);
  if (!start) return undefined;
  return toRange(start, new Date(start.getFullYear(), start.getMonth() + 1, 1));
};

/** The CEL timestamp field a time basis is stored under. */
export const getTimeBasisField = (timeBasis: MemoTimeBasis): "created_ts" | "updated_ts" =>
  timeBasis === "update_time" ? "updated_ts" : "created_ts";

/** A CEL clause selecting memos whose `field` falls inside `range`. */
export const buildTimestampRangeFilter = (field: "created_ts" | "updated_ts", range: LocalTimestampRange): string =>
  `${field} >= timestamp(${range.startTimestamp}) && ${field} < timestamp(${range.endTimestamp})`;

/** `filter` narrowed to memos whose `timeBasis` timestamp falls inside `range`; unchanged when there is no range. */
export const withTimestampRange = (
  filter: string | undefined,
  range: LocalTimestampRange | undefined,
  timeBasis: MemoTimeBasis,
): string | undefined => (range ? combineCELFilters(filter, buildTimestampRangeFilter(getTimeBasisField(timeBasis), range)) : filter);

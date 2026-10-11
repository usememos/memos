import type { MemoFilter } from "@/contexts/MemoFilterContext";
import { parseLocalDate } from "@/lib/calendar-utils";

/**
 * Derive a default `createTime` for a new memo from the active memo filters.
 * If a `displayTime:YYYY-MM-DD` filter is present, returns that local date
 * combined with `now`'s wall-clock hh:mm:ss. Returns undefined otherwise or
 * when the filter value is malformed.
 */
export function deriveDefaultCreateTimeFromFilters(filters: MemoFilter[], now: Date = new Date()): Date | undefined {
  const dateFilter = filters.find((f) => f.factor === "displayTime");
  if (!dateFilter) return undefined;
  return deriveDefaultCreateTimeFromDate(dateFilter.value, now);
}

/**
 * The local date `YYYY-MM-DD` combined with `now`'s wall-clock hh:mm:ss, so a memo composed
 * for a past day still orders naturally within it. Undefined for a malformed date.
 */
export function deriveDefaultCreateTimeFromDate(value: string, now: Date = new Date()): Date | undefined {
  const date = parseLocalDate(value);
  if (!date) return undefined;
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return date;
}

/**
 * Copy `date`'s calendar day and apply `now`'s wall-clock hh:mm:ss.
 * Used so a frozen filter-derived default still orders naturally at save time.
 */
export function withTimeOfDay(date: Date, now: Date = new Date()): Date {
  const next = new Date(date);
  next.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return next;
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * If timestamps are still the untouched calendar default — either the seeded
 * `defaultCreateTime` reference, or a prior shared restamp for that local day —
 * return a fresh stamp with `now`'s wall-clock time. Manual TimestampPopover
 * edits produce distinct Date objects and are left alone.
 */
export function resolveDefaultTimestamps(
  timestamps: { createTime?: Date; updateTime?: Date },
  defaultCreateTime: Date | undefined,
  now: Date = new Date(),
): { createTime?: Date; updateTime?: Date } {
  const { createTime, updateTime } = timestamps;
  if (!defaultCreateTime || !createTime) return timestamps;

  const untouched =
    createTime === defaultCreateTime ||
    (updateTime !== undefined && createTime === updateTime && isSameLocalDate(createTime, defaultCreateTime));
  if (!untouched) return timestamps;

  const restamped = withTimeOfDay(defaultCreateTime, now);
  return { createTime: restamped, updateTime: restamped };
}

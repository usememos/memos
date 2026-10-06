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
 * The same calendar date as `date`, combined with `now`'s wall-clock hh:mm:ss.
 * The input is not mutated.
 */
export function withTimeOfDay(date: Date, now: Date = new Date()): Date {
  const next = new Date(date);
  next.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return next;
}

/**
 * Re-stamp `time` with the current time of day when it is still the untouched
 * filter-derived default (the same `Date` object). The default is computed
 * once, when the filter is applied, so without this every memo saved from
 * that composer would be stored with the filter time instead of its save
 * time. A timestamp the user picked in the TimestampPopover is a different
 * object and is returned unchanged, so manual back-dating is preserved.
 */
export function restampUntouchedDefault(
  time: Date | undefined,
  defaultCreateTime: Date | undefined,
  now: Date = new Date(),
): Date | undefined {
  if (!time || !defaultCreateTime || time !== defaultCreateTime) return time;
  return withTimeOfDay(time, now);
}

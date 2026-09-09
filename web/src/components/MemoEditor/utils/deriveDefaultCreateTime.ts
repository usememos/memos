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

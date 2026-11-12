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
  return withTimeOfDay(date, now);
}

/** A copy of `date` whose wall-clock hh:mm:ss is taken from `now`; the calendar day is kept. */
export function withTimeOfDay(date: Date, now: Date = new Date()): Date {
  const next = new Date(date);
  next.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return next;
}

/**
 * The timestamp to send when a new memo is saved. A derived default is computed once
 * when the host selects a day and then held for every memo composed there, so if the
 * editor still carries that untouched default (same reference; the timestamp popover
 * dispatches a fresh `Date`), its time of day is re-stamped from `now` so consecutive
 * saves keep their order within the selected day. Anything else is returned as is.
 */
export function restampDefaultCreateTime(
  time: Date | undefined,
  defaultCreateTime: Date | undefined,
  now: Date = new Date(),
): Date | undefined {
  if (!time || !defaultCreateTime || time !== defaultCreateTime) return time;
  return withTimeOfDay(time, now);
}

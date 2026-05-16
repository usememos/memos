import type { MemoFilter } from "@/contexts/MemoFilterContext";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Derive a default `createTime` for a new memo from the active memo filters.
 * If a `displayTime:YYYY-MM-DD` filter is present, returns that local date
 * combined with `now`'s wall-clock hh:mm:ss. Returns undefined otherwise or
 * when the filter value is malformed.
 */
export function deriveDefaultCreateTimeFromFilters(filters: MemoFilter[], now: Date = new Date()): Date | undefined {
  const dateFilter = filters.find((f) => f.factor === "displayTime");
  if (!dateFilter) return undefined;
  const match = DATE_RE.exec(dateFilter.value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Construct a local-time Date and verify the components round-trip
  // (catches things like 2025-13-40 that JS would silently roll forward).
  const candidate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    return undefined;
  }
  return candidate;
}

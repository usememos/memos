import { parseLocalDate } from "@/lib/calendar-utils";
import { ROUTES } from "@/router/routes";

/** The route's params as react-router hands them over; a type alias so `useParams` can take it. */
export type CalendarRouteParams = { year?: string; month?: string; day?: string };

const pad2 = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM` for a year and a 1-based month. */
export const buildMonthKey = (year: number, month: number): string => `${year}-${pad2(month)}`;

/**
 * Resolve `/calendar/:year/:month/:day?` params. Month and day accept one or two digits so a
 * hand-typed `/calendar/2026/8` still lands; the canonical form is zero-padded. Returns
 * undefined for anything that is not a real calendar date so the page can redirect.
 */
export const parseCalendarParams = ({ year, month, day }: CalendarRouteParams): { month: string; date?: string } | undefined => {
  if (!year || !month || !/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) return undefined;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return undefined;
  const monthKey = buildMonthKey(Number(year), monthNumber);
  if (day === undefined) return { month: monthKey };
  if (!/^\d{1,2}$/.test(day)) return undefined;
  const date = `${monthKey}-${pad2(Number(day))}`;
  return parseLocalDate(date) ? { month: monthKey, date } : undefined;
};

/** Canonical path for a month, or for a day inside it when `date` is given. */
export const buildCalendarPath = (month: string, date?: string): string => {
  const base = `${ROUTES.CALENDAR}/${month.replace("-", "/")}`;
  return date ? `${base}/${date.slice(-2)}` : base;
};

export const getMonthOfDate = (date: string): string => date.slice(0, 7);

/** Month numbers with activity, grouped by year, from YYYY-MM-DD statistics keys. */
export const getCalendarActivityMonths = (activityStats: Record<string, number>): Record<number, number[]> => {
  const monthsByYear = new Map<number, Set<number>>();
  for (const [date, count] of Object.entries(activityStats)) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
    if (!match || count <= 0) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;
    const months = monthsByYear.get(year) ?? new Set<number>();
    months.add(month);
    monthsByYear.set(year, months);
  }
  return Object.fromEntries([...monthsByYear].map(([year, months]) => [year, [...months].sort((a, b) => a - b)]));
};

/** The day a month shows by default: today when the month is the current one, else the first. */
export const getDefaultDate = (month: string, today: string): string => (getMonthOfDate(today) === month ? today : `${month}-01`);

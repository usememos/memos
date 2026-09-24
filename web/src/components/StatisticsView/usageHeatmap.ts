import dayjs from "dayjs";

/** One cell in the heatmap grid. */
export interface HeatmapDay {
  /** YYYY-MM-DD in local time. */
  date: string;
  isToday: boolean;
  isFuture: boolean;
}

export interface ActivitySummary {
  /** Memos counted across the whole activity map. */
  total: number;
  /** Days with at least one memo. */
  days: number;
  /** Consecutive recorded days ending today, or yesterday while today is still unwritten. */
  streak: number;
}

export const HEATMAP_CELL_PITCH = 14; // 11px cell + 3px gap
export const HEATMAP_LABEL_COLUMN_WIDTH = 24;
export const HEATMAP_MIN_WEEKS = 8;
export const HEATMAP_MAX_WEEKS = 26;

/** flomo-style fit: as many whole week columns as the container can hold, clamped. */
export const weeksForWidth = (width: number): number => {
  const fit = Math.floor((width - HEATMAP_LABEL_COLUMN_WIDTH) / HEATMAP_CELL_PITCH);
  return Math.min(HEATMAP_MAX_WEEKS, Math.max(HEATMAP_MIN_WEEKS, fit));
};

/**
 * Columns run oldest to newest, each holding seven days from the week's first day
 * (aligned to `weekStartDayOffset`, 0 = Sunday). The final column is the week
 * containing `today`; days after `today` are flagged so the grid stays
 * rectangular while they render as blanks.
 */
export const buildHeatmapColumns = (weeks: number, weekStartDayOffset: number, today: Date = new Date()): HeatmapDay[][] => {
  const todayStart = dayjs(today).startOf("day");
  const todayKey = todayStart.format("YYYY-MM-DD");
  const offsetFromWeekStart = (todayStart.day() - weekStartDayOffset + 7) % 7;
  const firstWeekStart = todayStart.subtract(offsetFromWeekStart + (weeks - 1) * 7, "day");

  const columns: HeatmapDay[][] = [];
  for (let week = 0; week < weeks; week++) {
    const column: HeatmapDay[] = [];
    for (let day = 0; day < 7; day++) {
      const date = firstWeekStart.add(week * 7 + day, "day");
      const key = date.format("YYYY-MM-DD");
      column.push({ date: key, isToday: key === todayKey, isFuture: date.isAfter(todayStart) });
    }
    columns.push(column);
  }
  return columns;
};

/** Totals, active days and the current writing streak behind the heatmap caption. */
export const summarizeActivity = (data: Record<string, number>, today: Date = new Date()): ActivitySummary => {
  let total = 0;
  let days = 0;
  for (const count of Object.values(data)) {
    if (count > 0) {
      total += count;
      days += 1;
    }
  }

  let cursor = dayjs(today).startOf("day");
  if (!(data[cursor.format("YYYY-MM-DD")] > 0)) {
    // A day still in progress must not break the streak.
    cursor = cursor.subtract(1, "day");
  }
  let streak = 0;
  while (data[cursor.format("YYYY-MM-DD")] > 0) {
    streak += 1;
    cursor = cursor.subtract(1, "day");
  }

  return { total, days, streak };
};

import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import {
  buildHeatmapColumns,
  HEATMAP_CELL_PITCH,
  HEATMAP_LABEL_COLUMN_WIDTH,
  HEATMAP_MAX_WEEKS,
  HEATMAP_MIN_WEEKS,
  summarizeActivity,
  weeksForWidth,
} from "@/components/StatisticsView/usageHeatmap";

describe("buildHeatmapColumns", () => {
  const today = new Date(2026, 8, 24, 15, 30); // 2026-09-24 15:30 local time

  it("builds the requested number of gapless week columns ending this week", () => {
    const columns = buildHeatmapColumns(12, 1, today);
    expect(columns).toHaveLength(12);
    for (const column of columns) expect(column).toHaveLength(7);
    for (const column of columns) expect(dayjs(column[0].date).day()).toBe(1);

    const all = columns.flat().map((day) => day.date);
    for (let i = 1; i < all.length; i++) {
      expect(dayjs(all[i]).diff(dayjs(all[i - 1]), "day")).toBe(1);
    }
  });

  it("marks today exactly once and flags only later days as future", () => {
    const all = buildHeatmapColumns(12, 1, today).flat();
    const todayCells = all.filter((day) => day.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].date).toBe("2026-09-24");
    for (const day of all) {
      expect(day.isFuture).toBe(dayjs(day.date).isAfter(dayjs(today).startOf("day")));
    }
  });

  it("aligns columns to Sunday when the week starts on Sunday", () => {
    const columns = buildHeatmapColumns(4, 0, today);
    for (const column of columns) expect(dayjs(column[0].date).day()).toBe(0);
  });
});

describe("weeksForWidth", () => {
  it("clamps to the bounds and fits only whole columns", () => {
    expect(weeksForWidth(0)).toBe(HEATMAP_MIN_WEEKS);
    expect(weeksForWidth(10000)).toBe(HEATMAP_MAX_WEEKS);
    const exact = HEATMAP_LABEL_COLUMN_WIDTH + HEATMAP_CELL_PITCH * 12;
    expect(weeksForWidth(exact)).toBe(12);
    expect(weeksForWidth(exact - 1)).toBe(11);
  });
});

describe("summarizeActivity", () => {
  const today = new Date(2026, 8, 24, 12, 0);

  it("counts totals, active days and the streak ending yesterday when today is unwritten", () => {
    const data = { "2026-09-23": 2, "2026-09-22": 1, "2026-09-10": 5 };
    expect(summarizeActivity(data, today)).toEqual({ total: 8, days: 3, streak: 2 });
  });

  it("includes today in the streak once it has records", () => {
    const data = { "2026-09-24": 1, "2026-09-23": 3 };
    expect(summarizeActivity(data, today)).toEqual({ total: 4, days: 2, streak: 2 });
  });

  it("returns zeros for empty data", () => {
    expect(summarizeActivity({}, today)).toEqual({ total: 0, days: 0, streak: 0 });
  });
});

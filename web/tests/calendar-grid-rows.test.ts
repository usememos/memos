import { describe, expect, it } from "vitest";
import { rowsForCellHeight } from "@/components/CalendarView/CalendarGrid";

describe("calendar cell rows", () => {
  it.each([
    [88, 2],
    [96, 2],
    [105, 3],
    [140, 5],
    [40, 0],
  ])("fits %i px into %i memo rows", (height, rows) => {
    expect(rowsForCellHeight(height)).toBe(rows);
  });
});

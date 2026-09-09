import { describe, expect, it } from "vitest";
import { layoutForCellSize } from "@/components/CalendarView/CalendarDayCell";

describe("calendar snapshot sizing", () => {
  it("keeps narrow cells readable by omitting previews", () => {
    expect(layoutForCellSize(72, 140)).toMatchObject({ compact: true, textLines: 0, imageHeight: 0 });
  });
  it("limits short cells to the text that fits", () => {
    expect(layoutForCellSize(160, 88)).toMatchObject({ textLines: 2 });
    expect(layoutForCellSize(160, 40)).toMatchObject({ textLines: 0, imageHeight: 0 });
  });
  it("reduces photos when the day panel takes space without shrinking the type", () => {
    expect(layoutForCellSize(110, 160)).toMatchObject({ textLines: 3, imageCount: 1 });
    expect(layoutForCellSize(160, 160)).toMatchObject({ textLines: 3, imageCount: 2 });
  });
});

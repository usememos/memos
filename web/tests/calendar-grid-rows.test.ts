import { describe, expect, it } from "vitest";
import { layoutForCellSize } from "@/components/CalendarView/CalendarDayCell";

describe("calendar snapshot sizing", () => {
  it("keeps narrow cells readable by omitting previews", () => {
    expect(layoutForCellSize(72, 140)).toEqual({ textLines: 0, textLinesWithImages: 0, imageCount: 0 });
  });
  it("limits short cells to the 18px lines that fit", () => {
    expect(layoutForCellSize(160, 88)).toMatchObject({ textLines: 2, textLinesWithImages: 0, imageCount: 3 });
    expect(layoutForCellSize(160, 40)).toMatchObject({ textLines: 0, imageCount: 0 });
  });
  it("fits as many 36px photo marks as the width allows, capped at three", () => {
    expect(layoutForCellSize(110, 160)).toMatchObject({ textLines: 3, textLinesWithImages: 2, imageCount: 2 });
    expect(layoutForCellSize(160, 160)).toMatchObject({ textLines: 3, imageCount: 3 });
    expect(layoutForCellSize(300, 160)).toMatchObject({ imageCount: 3 });
  });
});

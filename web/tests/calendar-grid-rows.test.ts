import { describe, expect, it } from "vitest";
import { layoutForCellSize, planDayRows } from "@/components/CalendarView/CalendarDayCell";
import { RESERVED_BESIDE_PANEL } from "@/components/CalendarView/CalendarView";

describe("calendar snapshot sizing", () => {
  it("keeps very narrow cells readable by omitting previews", () => {
    expect(layoutForCellSize(56, 140)).toEqual({
      rows: 0,
      rowsWithImages: 0,
      textLines: 0,
      textLinesWithImages: 0,
      imageCount: 0,
      slim: false,
      mark: true,
    });
  });
  it("gives cells under preview width a slim preview instead of none", () => {
    expect(layoutForCellSize(92, 140)).toEqual({
      rows: 5,
      rowsWithImages: 2,
      textLines: 2,
      textLinesWithImages: 1,
      imageCount: 1,
      slim: true,
      mark: false,
    });
    expect(layoutForCellSize(64, 140)).toMatchObject({ slim: true, imageCount: 1 });
    expect(layoutForCellSize(100, 140)).toMatchObject({ slim: false, textLines: 3 });
  });
  it("marks the day instead when no preview fits, whatever the reason", () => {
    // Phones pass no height: the compact grid has no room for rows, even in a wide column.
    expect(layoutForCellSize(49, 0)).toMatchObject({ mark: true, textLines: 0, imageCount: 0 });
    expect(layoutForCellSize(95, 0)).toMatchObject({ mark: true, textLines: 0, imageCount: 0 });
    expect(layoutForCellSize(160, 60)).toMatchObject({ mark: true });
    expect(layoutForCellSize(160, 66)).toMatchObject({ mark: false, textLines: 1 });
    expect(layoutForCellSize(160, 88)).toMatchObject({ mark: false });
  });
  it("limits short cells to the 18px lines that fit", () => {
    expect(layoutForCellSize(160, 88)).toMatchObject({ textLines: 2, textLinesWithImages: 0, imageCount: 3 });
    expect(layoutForCellSize(160, 40)).toMatchObject({ textLines: 0, imageCount: 0 });
  });
  it("counts every 18px row that fits, however far a lone memo may run", () => {
    expect(layoutForCellSize(160, 160)).toMatchObject({ rows: 6, rowsWithImages: 4, textLines: 3, textLinesWithImages: 2 });
    expect(layoutForCellSize(160, 88)).toMatchObject({ rows: 2, rowsWithImages: 0 });
    // A strip that only just fits leaves no row above it, never a negative count.
    expect(layoutForCellSize(160, 85)).toMatchObject({ rowsWithImages: 0, textLinesWithImages: 0, imageCount: 3 });
  });
  it("fits as many 36px photo marks as the width allows, capped at three", () => {
    expect(layoutForCellSize(110, 160)).toMatchObject({ textLines: 3, textLinesWithImages: 2, imageCount: 2 });
    expect(layoutForCellSize(160, 160)).toMatchObject({ textLines: 3, imageCount: 3 });
    expect(layoutForCellSize(300, 160)).toMatchObject({ imageCount: 3 });
  });
});

describe("calendar day rows", () => {
  it("gives every memo a row when they all fit", () => {
    expect(planDayRows(3, 0, 5)).toEqual({ shown: 3, more: 0 });
    expect(planDayRows(5, 0, 5)).toEqual({ shown: 5, more: 0 });
  });
  it("folds the memos that do not fit into the last row", () => {
    expect(planDayRows(6, 0, 5)).toEqual({ shown: 4, more: 2 });
    expect(planDayRows(6, 0, 2)).toEqual({ shown: 1, more: 5 });
  });
  it("counts hidden memos on a row of their own, taking a memo's row only when it must", () => {
    expect(planDayRows(2, 1, 5)).toEqual({ shown: 2, more: 1 });
    expect(planDayRows(5, 2, 5)).toEqual({ shown: 4, more: 3 });
  });
  it("shows the first memo alone when one line is all there is", () => {
    expect(planDayRows(4, 0, 1)).toEqual({ shown: 1, more: 0 });
    expect(planDayRows(1, 3, 1)).toEqual({ shown: 1, more: 0 });
  });
  it("shows nothing without a line or without anything to read", () => {
    expect(planDayRows(4, 0, 0)).toEqual({ shown: 0, more: 0 });
    expect(planDayRows(0, 3, 5)).toEqual({ shown: 0, more: 0 });
  });
});

describe("calendar grid beside the open day panel", () => {
  // MemoPanel's width rule: the persisted width, capped by what the page reserves, never under 320px.
  const SIDEBAR = 256;
  const INSET = 12;
  const panelWidth = (viewport: number, persisted = 400) =>
    Math.min(Math.max(persisted, 320), Math.max(320, Math.min(640, viewport - SIDEBAR - 2 * INSET - RESERVED_BESIDE_PANEL)));
  // The pushed grid: page padding, the card and the gap before it come off; seven columns share the rest inside a 2px border.
  const columnWidth = (viewport: number, persisted?: number) => (viewport - SIDEBAR - 48 - panelWidth(viewport, persisted) - INSET - 2) / 7;

  it("keeps the persisted card where the window has room", () => {
    expect(panelWidth(1600)).toBe(400);
    expect(panelWidth(1440)).toBe(400);
    expect(columnWidth(1440)).toBeGreaterThanOrEqual(100);
  });
  it("narrows the card so every column keeps its full preview on laptop widths", () => {
    expect(panelWidth(1366)).toBe(348);
    expect(columnWidth(1366)).toBe(100);
    expect(layoutForCellSize(columnWidth(1366), 140).slim).toBe(false);
    expect(panelWidth(1440, 640)).toBeLessThan(640);
    expect(columnWidth(1440, 640)).toBeGreaterThanOrEqual(100);
  });
  it("falls back to slim previews only when even the minimum card does not leave preview width", () => {
    expect(panelWidth(1280)).toBe(320);
    expect(layoutForCellSize(columnWidth(1280), 140)).toMatchObject({ slim: true, textLines: 2, imageCount: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { layoutForCellSize } from "@/components/CalendarView/CalendarDayCell";
import { RESERVED_BESIDE_PANEL } from "@/components/CalendarView/CalendarView";

describe("calendar snapshot sizing", () => {
  it("keeps very narrow cells readable by omitting previews", () => {
    expect(layoutForCellSize(56, 140)).toEqual({ textLines: 0, textLinesWithImages: 0, imageCount: 0, slim: false, mark: true });
  });
  it("gives cells under preview width a slim preview instead of none", () => {
    expect(layoutForCellSize(92, 140)).toEqual({ textLines: 2, textLinesWithImages: 1, imageCount: 1, slim: true, mark: false });
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
  it("fits as many 36px photo marks as the width allows, capped at three", () => {
    expect(layoutForCellSize(110, 160)).toMatchObject({ textLines: 3, textLinesWithImages: 2, imageCount: 2 });
    expect(layoutForCellSize(160, 160)).toMatchObject({ textLines: 3, imageCount: 3 });
    expect(layoutForCellSize(300, 160)).toMatchObject({ imageCount: 3 });
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

import { describe, expect, it } from "vitest";
import { columnCountForWidth } from "@/components/ColumnGrid";

// Min column width 260px, gap 12px. A width fits N columns when
// floor((width + gap) / (minColumnWidth + gap)) === N, never below 1.
describe("columnCountForWidth", () => {
  it("never returns fewer than one column, even at zero width", () => {
    expect(columnCountForWidth(0)).toBe(1);
    expect(columnCountForWidth(100)).toBe(1);
    expect(columnCountForWidth(259)).toBe(1);
  });

  it("stays at one column just below the two-column threshold", () => {
    // 2*260 + 12 = 532 is the first width that fits two columns.
    expect(columnCountForWidth(531)).toBe(1);
  });

  it("reaches two columns exactly at the threshold (the list-fallback boundary)", () => {
    expect(columnCountForWidth(532)).toBe(2);
  });

  it("scales up with width", () => {
    expect(columnCountForWidth(804)).toBe(3);
    expect(columnCountForWidth(1152)).toBe(4);
    expect(columnCountForWidth(1600)).toBe(5);
  });
});

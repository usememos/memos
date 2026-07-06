import { describe, expect, it } from "vitest";
import { COMPACT_TOOLBAR_WIDTH, isCompactWidth } from "@/components/MemoEditor/hooks/useElementWidth";

describe("isCompactWidth", () => {
  it("treats an unmeasured (0) width as not compact (full layout default)", () => {
    expect(isCompactWidth(0)).toBe(false);
  });

  it("is compact below the threshold", () => {
    expect(isCompactWidth(COMPACT_TOOLBAR_WIDTH - 1)).toBe(true);
  });

  it("is not compact at or above the threshold", () => {
    expect(isCompactWidth(COMPACT_TOOLBAR_WIDTH)).toBe(false);
    expect(isCompactWidth(COMPACT_TOOLBAR_WIDTH + 200)).toBe(false);
  });
});

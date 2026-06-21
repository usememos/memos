import { describe, expect, it } from "vitest";
import {
  COMPACT_MODE_CONFIG,
  getCompactTriggerHeightPx,
  getPreviewMaxHeightPx,
  shouldCompactContent,
} from "@/components/MemoContent/constants";

describe("compact folded preview sizing", () => {
  it("clamps the collapsed preview to fewer rows than the fold trigger", () => {
    // Preview must be shorter than the trigger, otherwise folding shows everything.
    expect(COMPACT_MODE_CONFIG.previewRows).toBeLessThan(COMPACT_MODE_CONFIG.triggerRows);
    expect(getPreviewMaxHeightPx()).toBeLessThan(getCompactTriggerHeightPx());
  });

  it("folds only when content is taller than the trigger height", () => {
    const trigger = getCompactTriggerHeightPx();
    expect(shouldCompactContent(trigger + 1, trigger)).toBe(true);
  });

  it("leaves content at or below the trigger height fully expanded", () => {
    const trigger = getCompactTriggerHeightPx();
    // A memo a row or two over the preview but within the buffer stays open.
    expect(shouldCompactContent(getPreviewMaxHeightPx() + 1, trigger)).toBe(false);
    expect(shouldCompactContent(trigger, trigger)).toBe(false);
  });
});

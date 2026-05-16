import { describe, expect, it } from "vitest";
import { getTooltipText } from "@/components/ActivityCalendar/utils";

// Minimal stub for the i18n translate fn — returns a deterministic string we can assert on.
const t = ((key: string, vars?: Record<string, unknown>) => {
  if (!vars) return key;
  const parts = Object.entries(vars).map(([k, v]) => `${k}=${String(v)}`);
  return `${key}|${parts.join(",")}`;
}) as Parameters<typeof getTooltipText>[2];

describe("getTooltipText", () => {
  it("returns just the date when count is 0", () => {
    expect(getTooltipText(0, "2026-05-02", t)).toBe("2026-05-02");
  });

  it("uses the created-tooltip key for create_time basis (default)", () => {
    const out = getTooltipText(3, "2026-05-02", t);
    expect(out.toLowerCase()).toContain("memo.count-memos-in-date");
    expect(out.toLowerCase()).not.toContain("updated");
  });

  it("uses the updated-tooltip key for update_time basis", () => {
    const out = getTooltipText(3, "2026-05-02", t, "update_time");
    expect(out.toLowerCase()).toContain("memo.count-memos-updated-in-date");
  });
});

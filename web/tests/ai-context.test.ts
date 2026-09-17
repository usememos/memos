import { describe, expect, it } from "vitest";
import { buildContextFilter, describeContextSelection, formatTokenCount } from "@/lib/ai-context";

describe("buildContextFilter", () => {
  it("returns an empty filter when nothing is selected, which the server reads as no notes", () => {
    expect(buildContextFilter([])).toBe("");
    expect(buildContextFilter(["", "   "])).toBe("");
  });

  it("builds a single membership test for one tag", () => {
    expect(buildContextFilter(["journal"])).toBe('tag in ["journal"]');
  });

  it("joins several tags into one list", () => {
    expect(buildContextFilter(["journal", "work"])).toBe('tag in ["journal", "work"]');
  });

  it("de-duplicates and trims tags so a repeated chip cannot widen the query", () => {
    expect(buildContextFilter([" journal ", "journal", "work"])).toBe('tag in ["journal", "work"]');
  });

  it("escapes quotes and backslashes so a tag cannot break out of its string literal", () => {
    expect(buildContextFilter(['he said "hi"'])).toBe('tag in ["he said \\"hi\\""]');
    expect(buildContextFilter(["back\\slash"])).toBe('tag in ["back\\\\slash"]');
  });

  it("keeps tags containing filter punctuation inside the literal", () => {
    expect(buildContextFilter(["a && b", "c || d"])).toBe('tag in ["a && b", "c || d"]');
  });
});

describe("formatTokenCount", () => {
  it("groups thousands for readability", () => {
    expect(formatTokenCount(32000)).toBe("32,000");
    expect(formatTokenCount(500)).toBe("500");
  });
});

describe("describeContextSelection", () => {
  it("says plainly when no notes are selected", () => {
    expect(describeContextSelection(0, 0, 32000)).toBe("No notes selected");
  });

  it("reports the estimate against the budget", () => {
    expect(describeContextSelection(12, 4000, 32000)).toBe("12 notes · ~4,000 / 32,000 tokens");
  });

  it("uses the singular for a single note", () => {
    expect(describeContextSelection(1, 100, 32000)).toBe("1 note · ~100 / 32,000 tokens");
  });
});

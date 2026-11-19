import { describe, expect, it } from "vitest";
import { countTagRuleUsage, mergeTagCounts } from "@/lib/tag";

describe("countTagRuleUsage", () => {
  // Tag extraction is ancestor-closed (markdown.appendTagHierarchy): a memo
  // tagged #universidade/sts also carries #universidade, so the reporter's
  // two memos produce { universidade: 2, "universidade/sts": 1 }.
  const tagCounts = { universidade: 2, "universidade/sts": 1 };

  it("returns the stored count for an exact tag rule", () => {
    // Ancestor-inclusive like the home sidebar: the sts memo counts toward
    // its parent tag too, so this stays 2 rather than narrowing to 1.
    expect(countTagRuleUsage(tagCounts, "universidade")).toBe(2);
  });

  it("counts a parent wildcard once per memo family, not per tag", () => {
    // A naive sum is 2 + 1 = 3, but the sts memo is already inside the
    // ancestor-inclusive universidade count.
    expect(countTagRuleUsage(tagCounts, "universidade.*")).toBe(2);
  });

  it("counts a subtag-only wildcard without the ancestor", () => {
    expect(countTagRuleUsage(tagCounts, "universidade/.*")).toBe(1);
  });

  it("returns 0 when no tag matches the rule", () => {
    expect(countTagRuleUsage(tagCounts, "outra-coisa.*")).toBe(0);
    expect(countTagRuleUsage(tagCounts, "nao-existe")).toBe(0);
  });

  it("returns 0 for an invalid pattern", () => {
    expect(countTagRuleUsage(tagCounts, "[")).toBe(0);
  });

  it("excludes every matching tag that has a matching strict ancestor", () => {
    expect(countTagRuleUsage({ a: 4, "a/b": 2, "a/b/c": 1, d: 3 }, "a.*")).toBe(4);
  });

  it("sums incomparable matching literals as usages", () => {
    // A single memo can carry both a/x and a/y; exact per-memo counting would
    // need tag→memo sets from the stats API, which is out of scope.
    expect(countTagRuleUsage({ "a/x": 2, "a/y": 3 }, "a/.*")).toBe(5);
  });

  it("prefers the exact key over pattern matching", () => {
    // Same precedence as findTagMetadata: an exact tagCounts key wins even
    // when the rule would also match other tags as a regex.
    expect(countTagRuleUsage({ "a.b": 5, axb: 3 }, "a.b")).toBe(5);
  });

  it("handles prototype-shaped tag names", () => {
    const counts = mergeTagCounts({ toString: 4 });
    expect(countTagRuleUsage(counts, "toString")).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import { countTagRuleUsage } from "@/lib/tag";

describe("countTagRuleUsage", () => {
  const memoTags = [{ tags: ["universidade"] }, { tags: ["universidade", "universidade/sts"] }];

  it.each([
    ["universidade", 2],
    ["universidade.*", 2],
    ["universidade/.*", 1],
    ["outra-coisa.*", 0],
    ["[", 0],
  ])("counts memos matching %s", (rule, expected) => {
    expect(countTagRuleUsage(memoTags, rule)).toBe(expected);
  });

  it("distinguishes sibling tags on one memo from the same tags on separate memos", () => {
    expect(countTagRuleUsage([{ tags: ["a", "a/x", "a/y"] }], "a/.*")).toBe(1);
    expect(countTagRuleUsage([{ tags: ["a", "a/x"] }, { tags: ["a", "a/y"] }], "a/.*")).toBe(2);
  });

  it("keeps regex matches when a memo has the literal rule as a tag", () => {
    const memos = [{ tags: ["aaa"] }, { tags: ["aaa"] }];
    expect(countTagRuleUsage([...memos, { tags: ["a+"] }], "a+")).toBe(3);
    expect(countTagRuleUsage([{ tags: ["a+", "aaa"] }], "a+")).toBe(1);
  });

  it("counts literal tags that are invalid regexes or Object prototype keys", () => {
    expect(countTagRuleUsage([{ tags: ["C++"] }], "C++")).toBe(1);
    expect(countTagRuleUsage([{ tags: ["toString"] }], "toString")).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { getTagRuleUsage } from "@/lib/tag";

describe("getTagRuleUsage", () => {
  const counts = { universidade: 2, "universidade/sts": 1 };

  it("uses exact aggregate counts for a single match, including prototype-shaped and non-regex tags", () => {
    expect(getTagRuleUsage("universidade", counts)).toEqual({ count: 2 });
    expect(getTagRuleUsage("toString", counts)).toEqual({ count: 0 });
    expect(getTagRuleUsage("C++", { "C++": 1 })).toEqual({ count: 1 });
    expect(getTagRuleUsage("a+", { aaa: 2 })).toEqual({ count: 2 });
    expect(getTagRuleUsage("x|y", counts)).toEqual({ count: 0 });
  });

  it.each(["universidade", "universidade/", ""])("uses a compact filter for the literal prefix %j", (prefix) => {
    expect(getTagRuleUsage(`${prefix}.*`, counts)).toEqual({ filter: `tags.exists(t, t.startsWith(${JSON.stringify(prefix)}))` });
  });

  it("includes literal and anchored regex matches in a stable union", () => {
    expect(getTagRuleUsage("a+", { aaa: 2, "a+": 1, baaa: 1 })).toEqual({ filter: 'tag in ["a+","aaa"]' });
    expect(getTagRuleUsage("a[xy].*", { ax: 1, ay: 1, az: 1 })).toEqual({ filter: 'tag in ["ax","ay"]' });
  });

  it("checks the finished filter at the 8192-code-point boundary, including astral characters", () => {
    const tag = "😀".repeat(8192 - Array.from('tag in ["x",""]').length);
    const counts = { x: 1, [tag]: 1 };
    const rule = ".+";
    expect(getTagRuleUsage(rule, counts)).toEqual({ filter: `tag in ["x","${tag}"]` });
    expect(getTagRuleUsage(rule, { x: 1, [tag + "😀"]: 1 })).toEqual({});
    expect(getTagRuleUsage("x".repeat(8192) + ".*", counts)).toEqual({});
  });

  it("groups large literal lists in one filter so a memo matching several groups counts once", () => {
    const tags = Array.from({ length: 1001 }, (_, i) => String.fromCharCode(0x4e00 + i));
    const counts = Object.fromEntries(tags.map((tag) => [tag, 1]));
    const groups = [tags.slice(0, 500), tags.slice(500, 1000), tags.slice(1000)];
    expect(getTagRuleUsage(".+", counts)).toEqual({ filter: groups.map((group) => `tag in ${JSON.stringify(group)}`).join(" || ") });
  });
});

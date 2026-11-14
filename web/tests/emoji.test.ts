import { describe, expect, it } from "vitest";
import { EMOJI_OPTIONS, findEmoji } from "@/lib/emoji";
import { FULLY_QUALIFIED_EMOJI } from "@/utils/tag-unicode-data";

describe("reaction emoji catalog", () => {
  it("includes the complete Unicode emoji set with names", () => {
    expect(EMOJI_OPTIONS.map(({ emoji }) => emoji)).toEqual(FULLY_QUALIFIED_EMOJI);
    expect(EMOJI_OPTIONS.every(({ name }) => name.length > 0)).toBe(true);
  });
  it("finds names, aliases, skin tones, flags and pasted sequences", () => {
    expect(findEmoji(":thumbsup:").some(({ emoji }) => emoji === "👍")).toBe(true);
    expect(findEmoji("tada").some(({ emoji }) => emoji === "🎉")).toBe(true);
    expect(findEmoji("medium skin tone thumbs up").some(({ emoji }) => emoji === "👍🏽")).toBe(true);
    expect(findEmoji("singapore").map(({ emoji }) => emoji)).toContain("🇸🇬");
    expect(findEmoji("👩‍💻").map(({ emoji }) => emoji)).toEqual(["👩‍💻"]);
    expect(findEmoji("no-such-emoji")).toEqual([]);
  });
});

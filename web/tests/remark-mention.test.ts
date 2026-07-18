import { describe, expect, it } from "vitest";
import { parseMentionsFromText } from "@/utils/remark-plugins/remark-mention";

describe("parseMentionsFromText", () => {
  it("accepts a 63-character username", () => {
    const username = `a${"b".repeat(62)}`;
    expect(parseMentionsFromText(`@${username}`)).toEqual([{ type: "mention", value: username }]);
  });

  it("leaves a 64-character username as text", () => {
    const username = `a${"b".repeat(63)}`;
    expect(parseMentionsFromText(`@${username}`)).toEqual([{ type: "text", value: `@${username}` }]);
  });
});

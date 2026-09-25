import { describe, expect, it } from "vitest";
import { extractTagEmoji } from "@/lib/tag";

describe("extractTagEmoji", () => {
  it("returns plain tags untouched", () => {
    expect(extractTagEmoji("读书")).toEqual({ text: "读书" });
    expect(extractTagEmoji("tech/backend")).toEqual({ text: "tech/backend" });
  });

  it("extracts a leading emoji as the icon and strips it from the label", () => {
    expect(extractTagEmoji("📗读书")).toEqual({ icon: "📗", text: "读书" });
    expect(extractTagEmoji("❓疑问")).toEqual({ icon: "❓", text: "疑问" });
  });

  it("handles variation selectors, skin tones and ZWJ sequences", () => {
    expect(extractTagEmoji("✍️摘抄")).toEqual({ icon: "✍️", text: "摘抄" });
    expect(extractTagEmoji("👍🏽赞")).toEqual({ icon: "👍🏽", text: "赞" });
    expect(extractTagEmoji("👨‍👩‍👧家庭")).toEqual({ icon: "👨‍👩‍👧", text: "家庭" });
  });

  it("only treats the emoji before the tag text, keeping nested paths", () => {
    expect(extractTagEmoji("📗读书/小说")).toEqual({ icon: "📗", text: "读书/小说" });
  });

  it("ignores emoji that are not leading", () => {
    expect(extractTagEmoji("读书📗")).toEqual({ text: "读书📗" });
  });

  it("keeps an emoji-only tag name as the label instead of rendering nothing", () => {
    expect(extractTagEmoji("📗")).toEqual({ text: "📗" });
  });
});

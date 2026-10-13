import { matchToken, type SuggestionAllowContext, scanTags } from "@usememos/editor";
import { describe, expect, it } from "vitest";
import { allowTagSuggestion, rankTags } from "@/components/MemoEditor/Editor/extensions";

const match = matchToken(scanTags);

/** The token the tag popup sees with the caret at the end of `text`. */
const tokenAtEnd = (text: string) => match({ text, caret: text.length, content: [{ text, marks: [] }], triggers: ["#", "＃"] });

const allowContext = (overrides: Partial<SuggestionAllowContext>): SuggestionAllowContext =>
  ({ excluded: false, explicit: false, query: "", textBefore: "", from: 0, ...overrides }) as SuggestionAllowContext;

describe("tag suggestion matching", () => {
  it.each(["hello #", "#t", "- [ ] #", "#work/", "first line\n#work/"])("finds a tag token being typed: %s", (text) => {
    expect(tokenAtEnd(text)).not.toBeNull();
  });

  it.each(["", "hello world", "C#", "hello#work", "#work//"])("finds no tag token in %s", (text) => {
    expect(tokenAtEnd(text)).toBeNull();
  });
});

describe("tag suggestion ranking", () => {
  it("matches a segment of a nested tag path without its parents", () => {
    expect(rankTags(["software/hosted/Memos"], "Mem")).toEqual(["software/hosted/Memos"]);
  });

  it("ranks full-path prefixes above segment starts above loose substrings", () => {
    expect(rankTags(["home/paperwork", "team/work-log", "work/project"], "work")).toEqual([
      "work/project",
      "team/work-log",
      "home/paperwork",
    ]);
  });

  it("completes child tags after a path separator", () => {
    expect(rankTags(["work/private", "work/project", "home"], "work/")).toEqual(["work/private", "work/project"]);
  });

  it("offers every tag for a bare hash and none when nothing matches", () => {
    expect(rankTags(["todo", "work"], "")).toEqual(["todo", "work"]);
    expect(rankTags(["todo"], "missing")).toEqual([]);
  });
});

describe("where the tag popup opens", () => {
  it("stays closed inside code and links", () => {
    expect(allowTagSuggestion(allowContext({ excluded: true, query: "t" }))).toBe(false);
  });

  it.each(["", "  ", "first line\n"])("stays closed for a bare hash that may start a heading: %j", (textBefore) => {
    expect(allowTagSuggestion(allowContext({ textBefore }))).toBe(false);
  });

  it("opens for a bare hash after text, for a hash with a query, and on Ctrl+Space", () => {
    expect(allowTagSuggestion(allowContext({ textBefore: "hello " }))).toBe(true);
    expect(allowTagSuggestion(allowContext({ query: "t" }))).toBe(true);
    expect(allowTagSuggestion(allowContext({ explicit: true }))).toBe(true);
  });
});

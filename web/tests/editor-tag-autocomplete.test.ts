import { Editor, matchToken, type SuggestionAllowContext, scanTags } from "@usememos/editor";
import { describe, expect, it, vi } from "vitest";
import { allowTagSuggestion, buildEditorExtensions, rankTags } from "@/components/MemoEditor/edit/extensions";

const match = matchToken(scanTags);

/** The token the tag popup sees with the caret at the end of `text`. */
const tokenAtEnd = (text: string) => match({ text, caret: text.length, content: [{ text, marks: [] }], triggers: ["#", "＃"] });

const allowContext = (overrides: Partial<SuggestionAllowContext>): SuggestionAllowContext =>
  ({ excluded: false, explicit: false, query: "", textBefore: "", from: 0, ...overrides }) as SuggestionAllowContext;

describe("tag suggestion matching", () => {
  it.each(["hello #", "#t", "- [ ] #", "#work/", "first line\n#work/", "hello#work", "C#", "#2024", "＃t"])(
    "finds a tag token being typed: %s",
    (text) => {
      expect(tokenAtEnd(text)).not.toBeNull();
    },
  );

  it.each(["", "hello world", "#work//"])("finds no tag token in %s", (text) => {
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

it("offers the AI command alone only when the picker was asked for", async () => {
  const config = buildEditorExtensions({
    getTags: () => [],
    getTagAction: () => ({ label: "Suggest tags with AI", request: vi.fn() }),
    onFiles: vi.fn(),
    emojiLabel: "Emoji",
  })[0].suggestion!;
  const editor = new Editor({ element: document.createElement("div"), content: "A note #" });
  try {
    const find = (explicit: boolean) =>
      config.items({ editor, query: "", explicit, composing: false, signal: new AbortController().signal });
    expect(await find(false)).toEqual([]);
    expect((await find(true)).map((item) => item.label)).toEqual(["Suggest tags with AI"]);
  } finally {
    editor.destroy();
  }
});

it("lists every matching tag when the AI command is not offered", async () => {
  const tags = Array.from({ length: 60 }, (_, i) => `tag${i}`);
  const config = buildEditorExtensions({ getTags: () => tags, onFiles: vi.fn(), emojiLabel: "Emoji" })[0].suggestion!;
  const editor = new Editor({ element: document.createElement("div"), content: "Before #ta" });
  try {
    const items = await config.items({ editor, query: "ta", explicit: false, composing: false, signal: new AbortController().signal });
    expect(items).toHaveLength(60);
    expect(config.limit).toBeUndefined();
  } finally {
    editor.destroy();
  }
});

describe.each(["rich", "source"] as const)("%s tag picker", (mode) => {
  it("keeps local completion and the AI command distinct and replaces only the active full-width token", async () => {
    const request = vi.fn();
    const tags = Array.from({ length: 60 }, (_, i) => `tag${i}`);
    const extensions = buildEditorExtensions({
      getTags: () => tags,
      getTagAction: () => ({ label: "Suggest tags with AI", request }),
      onFiles: vi.fn(),
      emojiLabel: "Emoji",
    });
    const config = extensions[0].suggestion!;
    const editor = new Editor({ element: document.createElement("div"), content: "Before ＃ta, after", mode, extensions });
    try {
      const query = "ta";
      const findItems = (query: string) =>
        config.items({ editor, query, explicit: false, composing: false, signal: new AbortController().signal });
      const items = await findItems(query);
      expect(items.map((item) => item.label)).toEqual(["#tag0", "#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "Suggest tags with AI"]);
      expect(await findItems("")).toEqual(items);
      expect((await findItems("tag59"))[0].label).toBe("#tag59");
      expect(await findItems("new-tag")).toEqual([]);
      expect(request).not.toHaveBeenCalled();
      const blockId = editor.state.doc.blocks[0].id;
      const range = { from: { blockId, offset: 7 }, to: { blockId, offset: 10 } };
      config.command!({ editor, query, range, item: items[0] });
      expect(editor.getMarkdown()).toBe("Before #tag0, after");
      expect(request).not.toHaveBeenCalled();
      config.command!({ editor, query: "tag0", range: { ...range, to: { blockId, offset: 12 } }, item: items.at(-1)! });
      expect(request).toHaveBeenCalledWith("Before , after");
      expect(editor.getSelection().focus.offset).toBe(7);
    } finally {
      editor.destroy();
    }
  });
});

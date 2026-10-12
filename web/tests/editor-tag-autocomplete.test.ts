import { acceptCompletion, CompletionContext, completionStatus, currentCompletions } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "@/components/MemoEditor/Editor/extensions";
import { makeTagCompletionSource } from "@/components/MemoEditor/Editor/tagAutocomplete";
import { memoMarkdownExtensions } from "@/utils/memo-markdown-extension";

function complete(doc: string, pos: number, tags: string[], explicit = false) {
  const source = makeTagCompletionSource(() => tags);
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: memoMarkdownExtensions })] });
  return source(new CompletionContext(state, pos, explicit));
}

describe("tag autocomplete", () => {
  it("offers known tags after one character", () => {
    expect(complete("#t", 2, ["thoughts", "today", "work"])?.options.map((o) => o.label)).toEqual(["thoughts", "today"]);
  });

  it.each(["hello #", "hello#", "## heading #", "> text #", "- [ ] #", "#######"])("offers all tags after a bare hash: %s", (doc) => {
    const result = complete(doc, doc.length, ["todo", "work"]);
    expect(result?.from).toBe(doc.length);
    expect(result?.options.map((o) => o.label)).toEqual(["todo", "work"]);
  });

  it.each([
    "#",
    "##",
    "######",
    "   #",
    "> #",
    "> > ###",
    "- #",
    "1. ##",
    "- item\n  #",
    "> - ##",
  ])("does not automatically complete an opening heading marker: %s", (doc) => expect(complete(doc, doc.length, ["todo"])).toBeNull());

  it("does not complete an opening heading marker before existing heading text", () => {
    for (const pos of [1, 2, 3]) expect(complete("## heading", pos, ["todo"])).toBeNull();
  });

  it.each(["#", "> ##", "- #"])("allows explicit completion at an opening heading marker: %s", (doc) => {
    expect(complete(doc, doc.length, ["todo"], true)?.options.map((o) => o.label)).toEqual(["todo"]);
  });

  it.each(["#t", "##t", "> #t", "- #t", "1. #t"])("offers tags once the input is not a heading marker: %s", (doc) => {
    expect(complete(doc, doc.length, ["thoughts"])?.options.map((o) => o.label)).toEqual(["thoughts"]);
  });

  it.each([
    "`#│`",
    "```\n#│\n```",
    "    #│",
    "[#│](/path)",
    "![#│](/path)",
    "[label](https://example.com/#│)",
    "https://example.com/#│",
    "www.點看.com/#│",
    "\\#│",
    "$#│$",
    "$$\n#│\n$$",
    '<span title="#│">',
    "<!-- #│ -->",
    "[#│][known]\n\n[known]: /path",
    "#│foo@example.com",
  ])("completes bare and partial tags regardless of surrounding Markdown: %s", (source) => {
    for (const typed of ["", "t"]) {
      const pos = source.indexOf("│");
      const result = complete(source.replace("│", typed), pos + typed.length, ["thoughts"]);
      expect(result?.from).toBe(pos);
      expect(result?.options.map((o) => o.label)).toEqual(["thoughts"]);
    }
  });

  it("does not depend on parsing a distant reference definition", () => {
    const doc = `[#ta][known]\n\n${"x".repeat(120_000)}\n\n[known]: /path`;
    expect(complete(doc, doc.indexOf("]"), ["tag"])?.options.map((o) => o.label)).toEqual(["tag"]);
  });

  it.each(["", "hello world", "# ", "#tag ", "#work//", "&#35;to"])("does not offer tags outside an active tag input: %s", (doc) => {
    expect(complete(doc, doc.length, ["todo", "work/project"])).toBeNull();
  });

  it("returns null when no known tags match", () => {
    expect(complete("hello #", 7, [])).toBeNull();
    expect(complete("#missing", 8, ["todo"])).toBeNull();
  });

  it("matches a segment of a nested tag path without its parents", () => {
    expect(complete("hello #Mem", 10, ["software/hosted/Memos"])?.options.map((o) => o.label)).toEqual(["software/hosted/Memos"]);
  });

  it("ranks full-path prefixes above segment starts above loose substrings", () => {
    const result = complete("#work", 5, ["home/paperwork", "team/work-log", "work/project"]);
    expect(result?.options.map((o) => o.label)).toEqual(["work/project", "team/work-log", "home/paperwork"]);
    expect(result?.filter).toBe(false);
  });

  it.each(["#work/", "#work/pr", "hello#work/", "first line\n#work/"])("completes child tags after a path separator: %s", (doc) => {
    const result = complete(doc, doc.length, ["work", "work/private", "work/project", "home"]);
    expect(result?.from).toBe(doc.lastIndexOf("#") + 1);
    expect(result?.options.map((o) => o.label)).toEqual(["work/private", "work/project"]);
  });

  it.each(["#hosted/", "#software/hosted/"])("matches nested paths at any depth: %s", (doc) => {
    const result = complete(doc, doc.length, ["software/hosted/Memos"]);
    expect(result?.options.map((o) => o.label)).toEqual(["software/hosted/Memos"]);
    expect(result?.from).toBe(1);
  });

  it("filters by the emitted Unicode value and replaces the source spelling", () => {
    const result = complete("#A‍B", 4, ["AB", "acorn"]);
    expect(result?.from).toBe(1);
    expect(result?.options.map((o) => o.label)).toEqual(["AB"]);
    expect(complete("#工作/", 4, ["工作/项目"])?.options.map((o) => o.label)).toEqual(["工作/项目"]);
  });

  it("completes tags containing word-internal apostrophes", () => {
    expect(complete("#O'Br", 5, ["O'Brien", "O’Connor"])?.options.map((o) => o.label)).toEqual(["O'Brien"]);
    expect(complete("#O’Co", 5, ["O'Brien", "O’Connor"])?.options.map((o) => o.label)).toEqual(["O’Connor"]);
  });

  it("distinguishes keycap emoji from a tag introducer", () => {
    expect(complete("#️⃣", 3, ["#️⃣"])).toBeNull();
    const result = complete("##️⃣", 4, ["#️⃣"]);
    expect(result?.from).toBe(1);
    expect(result?.options.map((o) => o.label)).toEqual(["#️⃣"]);
    for (const [doc, pos] of [
      ["#️⃣", 1],
      ["##️⃣", 2],
      ["#first#️⃣", 7],
    ] as const) {
      expect(complete(doc, pos, ["todo"], true)).toBeNull();
    }
  });
});

// Exercise automatic activation and insertion through the real editor extensions.
describe("tag completion popup", () => {
  it.each([
    ["hello ", "#", "hello #software/hosted/Memos"],
    ["", "#Mem", "#software/hosted/Memos"],
    ["", "#software/hosted/", "#software/hosted/Memos"],
  ])("opens and inserts a full nested tag after typing %s%s", async (initial, input, expected) => {
    const view = new EditorView({
      state: EditorState.create({
        doc: initial,
        selection: { anchor: initial.length },
        extensions: buildEditorExtensions({
          placeholder: "",
          onChange: () => {},
          onFiles: () => {},
          onUpdate: () => {},
          onSubmit: () => {},
          getTags: () => ["software/hosted/Memos"],
        }),
      }),
      parent: document.body,
    });
    try {
      view.focus();
      for (const character of input) {
        view.dispatch({
          changes: { from: view.state.selection.main.head, insert: character },
          selection: { anchor: view.state.selection.main.head + character.length },
          userEvent: "input.type",
        });
      }
      await waitFor(() => expect(completionStatus(view.state)).toBe("active"));
      expect(currentCompletions(view.state).map((o) => o.label)).toEqual(["software/hosted/Memos"]);
      // CodeMirror briefly ignores acceptance just after the popup opens.
      await waitFor(() => expect(acceptCompletion(view)).toBe(true));
      expect(view.state.doc.toString()).toBe(expected);
    } finally {
      view.destroy();
    }
  });
});

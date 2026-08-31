import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { createFormattingController } from "@/components/MemoEditor/Editor/formatting";
import { formattingKeymap } from "@/components/MemoEditor/Editor/formattingKeymap";

function setup(doc: string, from: number, to: number) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdown({ extensions: [GFM] })], selection: EditorSelection.range(from, to) }),
  });
  return { view, f: createFormattingController(view, new Set()) };
}

describe("formatting keymap", () => {
  it("binds the conventional chords, each claiming the browser default", () => {
    expect(formattingKeymap.map((b) => b.key)).toEqual(["Mod-b", "Mod-i", "Mod-Shift-x", "Mod-e", "Mod-k"]);
    expect(formattingKeymap.every((b) => b.preventDefault)).toBe(true);
  });

  it("runs the same command the toolbar does", () => {
    const { view } = setup("hello world", 0, 5);
    const bold = formattingKeymap.find((b) => b.key === "Mod-b");
    bold?.run?.(view);
    expect(view.state.doc.toString()).toBe("**hello** world");
    bold?.run?.(view);
    expect(view.state.doc.toString()).toBe("hello world");
  });
});

describe("link cursor placement", () => {
  it("lands between the parens when no url was supplied, ready for typing", () => {
    const { view, f } = setup("read this", 5, 9);
    f.run("link");
    expect(view.state.doc.toString()).toBe("read [this]()");
    expect(view.state.selection.main.anchor).toBe("read [this](".length);
  });

  it("lands after the finished link when a url was supplied", () => {
    const { view, f } = setup("read this", 5, 9);
    f.run("link", { url: "https://example.com" });
    expect(view.state.doc.toString()).toBe("read [this](https://example.com)");
    expect(view.state.selection.main.anchor).toBe("read [this](https://example.com)".length);
  });
});

import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { createFormattingController } from "@/components/MemoEditor/Editor/formatting";

function setup(doc: string, from: number, to: number) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [markdown()], selection: EditorSelection.range(from, to) }),
  });
  return { view, f: createFormattingController(view, new Set()) };
}

describe("formatting controller", () => {
  it("wraps selection in bold and reports active", () => {
    const { view, f } = setup("hello world", 0, 5);
    f.run("bold");
    expect(view.state.doc.toString()).toBe("**hello** world");
    view.dispatch({ selection: { anchor: 3 } });
    expect(f.getActiveFormats().bold).toBe(true);
  });

  it("prefixes a heading and reports its level", () => {
    const { view, f } = setup("Title", 0, 0);
    f.run("heading1");
    expect(view.state.doc.toString()).toBe("# Title");
    view.dispatch({ selection: { anchor: 3 } });
    expect(f.getActiveFormats().headingLevel).toBe(1);
  });

  it("toggles a bullet list line", () => {
    const { view, f } = setup("item", 0, 0);
    f.run("bulletList");
    expect(view.state.doc.toString()).toBe("- item");
    f.run("bulletList");
    expect(view.state.doc.toString()).toBe("item");
  });

  it("unbolds when already bold", () => {
    const { view, f } = setup("**hello** world", 4, 4); // cursor inside bold
    f.run("bold");
    expect(view.state.doc.toString()).toBe("hello world");
  });

  it("unwraps italic when already italic", () => {
    const { view, f } = setup("*hi* there", 2, 2);
    f.run("italic");
    expect(view.state.doc.toString()).toBe("hi there");
  });

  it("unwraps inline code when already code", () => {
    const { view, f } = setup("`code` here", 3, 3);
    f.run("code");
    expect(view.state.doc.toString()).toBe("code here");
  });
});

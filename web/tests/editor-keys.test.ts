import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";
import { buildEditorExtensions } from "@/components/MemoEditor/Editor/extensions";

function makeView(doc: string) {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: buildEditorExtensions({ placeholder: "", onChange: () => {}, onUpdate: () => {}, getTags: () => [] }),
    }),
    parent: document.body,
  });
}

function press(view: EditorView, key: string, opts: KeyboardEventInit = {}) {
  view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

/** Place the cursor on the given 1-based line, then press Tab/Shift-Tab. */
function tabOnLine(view: EditorView, lineNumber: number, shiftKey = false) {
  const line = view.state.doc.line(lineNumber);
  view.dispatch({ selection: { anchor: line.to } });
  press(view, "Tab", { shiftKey });
}

describe("editor key bindings", () => {
  it("Tab indents a non-list line by two spaces", () => {
    const view = makeView("hello");
    view.dispatch({ selection: { anchor: 0 } });
    press(view, "Tab");
    expect(view.state.doc.toString()).toBe("  hello");
    view.destroy();
  });

  it("Escape blurs the editor (keyboard escape hatch)", () => {
    const view = makeView("x");
    view.focus();
    expect(view.hasFocus).toBe(true);
    press(view, "Escape");
    expect(view.hasFocus).toBe(false);
    view.destroy();
  });

  it("Tab nests an ordered item: marker-aligned indent + renumbered to 1", () => {
    const view = makeView("1. a\n2. b");
    tabOnLine(view, 2);
    // 3-space indent (past "1. ") AND renumbered 2 -> 1 so CommonMark nests it.
    expect(view.state.doc.toString()).toBe("1. a\n   1. b");
    view.destroy();
  });

  it("Tab nests a bullet item to two spaces", () => {
    const view = makeView("- a\n- b");
    tabOnLine(view, 2);
    expect(view.state.doc.toString()).toBe("- a\n  - b");
    view.destroy();
  });

  it("Shift-Tab outdents a nested list item back to its parent level", () => {
    const view = makeView("1. a\n   2. b");
    tabOnLine(view, 2, true);
    expect(view.state.doc.toString()).toBe("1. a\n2. b");
    view.destroy();
  });

  it("Tab-nested ordered lists render nested in the display (no flat siblings)", () => {
    const view = makeView("1. a\n2. b\n3. c");
    tabOnLine(view, 2); // nest b under a
    tabOnLine(view, 3); // nest c under a ...
    tabOnLine(view, 3); // ... then under b
    const md = view.state.doc.toString();
    view.destroy();
    // Each nested level renumbers to 1, which is what CommonMark requires to
    // nest an ordered sublist (a 2./3. start can't interrupt the parent line).
    expect(md).toBe("1. a\n   1. b\n      1. c");
    // remark-gfm (the display) now reads this as three nested ordered lists.
    const html = renderToStaticMarkup(
      React.createElement(MemoMarkdownRenderer, { content: md, resolvedMentionUsernames: new Set<string>() }),
    );
    expect((html.match(/<ol/g) ?? []).length).toBe(3);
  });
});

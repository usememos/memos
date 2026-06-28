import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { headingDecorations } from "@/components/MemoEditor/Editor/headingDecorations";

function hasClass(doc: string, cls: string): boolean {
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [markdown(), headingDecorations] }), parent: document.body });
  const found = view.dom.querySelector(`.${cls}`) !== null;
  view.destroy();
  return found;
}

describe("heading line decorations require a space", () => {
  it("styles '# Title' as h1", () => expect(hasClass("# Title", "cm-md-h1")).toBe(true));
  it("styles '### x' as h3", () => expect(hasClass("### x", "cm-md-h3")).toBe(true));
  it("does NOT style a bare '#'", () => expect(hasClass("#", "cm-md-h1")).toBe(false));
  it("does NOT style '#tag' (no space)", () => expect(hasClass("#tag", "cm-md-h1")).toBe(false));
});

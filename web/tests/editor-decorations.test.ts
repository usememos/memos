import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { tagMentionDecorations } from "@/components/MemoEditor/Editor/tagMentionDecorations";

function countClass(doc: string, cls: string): number {
  const view = new EditorView({ state: EditorState.create({ doc, extensions: [tagMentionDecorations] }), parent: document.body });
  const n = view.dom.querySelectorAll(`.${cls}`).length;
  view.destroy();
  return n;
}

describe("tag/mention decorations", () => {
  it("decorates #tags", () => expect(countClass("a #todo and #work/sub b", "cm-memo-tag")).toBe(2));
  it("decorates @mentions", () => expect(countClass("hi @alice", "cm-memo-mention")).toBe(1));
});

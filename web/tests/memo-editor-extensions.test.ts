import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "@/components/MemoEditor/Editor/extensions";

describe("MemoEditor CodeMirror extensions", () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
    }
    document.body.replaceChildren();
  });

  it("uses CodeMirror's selection and placeholder extensions without enabling multi-cursor selection", () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const state = EditorState.create({
      doc: "",
      extensions: buildEditorExtensions({
        placeholder: "Any thoughts...",
        onChange: vi.fn(),
        onUpdate: vi.fn(),
        onSubmit: vi.fn(),
        getTags: () => [],
      }),
    });
    const view = new EditorView({ state, parent });
    views.push(view);

    expect(view.state.facet(EditorState.allowMultipleSelections)).toBe(false);
    expect(view.dom.querySelector(".cm-selectionLayer")).not.toBeNull();
    expect(view.dom.querySelector(".cm-cursorLayer")).not.toBeNull();
    expect(view.contentDOM).toHaveAttribute("aria-placeholder", "Any thoughts...");
    expect(view.dom.querySelector(".cm-placeholder")).toHaveTextContent("Any thoughts...");
  });
});

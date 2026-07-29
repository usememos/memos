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

  it("disables multi-cursor selection and wires up the placeholder", () => {
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

    // No drawSelection(): the browser's native caret (editor.css sets
    // caret-color) and ::selection own rendering, so there's no
    // .cm-selectionLayer/.cm-cursorLayer to assert on here.
    expect(view.state.facet(EditorState.allowMultipleSelections)).toBe(false);
    expect(view.contentDOM).toHaveAttribute("aria-placeholder", "Any thoughts...");
    expect(view.dom.querySelector(".cm-placeholder")).toHaveTextContent("Any thoughts...");
  });
});

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

  it("uses the native selection and CodeMirror placeholder without enabling multi-cursor selection", () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const state = EditorState.create({
      doc: "",
      extensions: buildEditorExtensions({
        placeholder: "Any thoughts...",
        onChange: vi.fn(),
        onFiles: vi.fn(),
        onUpdate: vi.fn(),
        onSubmit: vi.fn(),
        getTags: () => [],
      }),
    });
    const view = new EditorView({ state, parent });
    views.push(view);

    expect(view.state.facet(EditorState.allowMultipleSelections)).toBe(false);
    expect(view.dom.querySelector(".cm-selectionLayer")).toBeNull();
    expect(view.dom.querySelector(".cm-cursorLayer")).toBeNull();
    expect(view.contentDOM).toHaveAttribute("aria-placeholder", "Any thoughts...");
    expect(view.dom.querySelector(".cm-placeholder")).toHaveTextContent("Any thoughts...");
  });

  it.each([
    ["paste", "clipboardData"],
    ["drop", "dataTransfer"],
  ] as const)("intercepts files on %s before CodeMirror inserts their contents", (eventType, transferProperty) => {
    const onFiles = vi.fn();
    const parent = document.body.appendChild(document.createElement("div"));
    const view = new EditorView({
      state: EditorState.create({
        doc: "memo",
        extensions: buildEditorExtensions({
          placeholder: "",
          onChange: vi.fn(),
          onFiles,
          onUpdate: vi.fn(),
          onSubmit: vi.fn(),
          getTags: () => [],
        }),
      }),
      parent,
    });
    views.push(view);
    const file = new File(["must not become memo content"], "attachment.txt", { type: "text/plain" });
    const transfer =
      eventType === "paste"
        ? { items: [{ kind: "file", getAsFile: () => file }], files: [file] }
        : { files: [file], types: ["Files"] };
    const event = new Event(eventType, { bubbles: true, cancelable: true });
    Object.defineProperty(event, transferProperty, { value: transfer });

    view.contentDOM.dispatchEvent(event);

    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("memo");
  });
});

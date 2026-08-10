import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { createController } from "@/components/MemoEditor/Editor/controller";
import { type UploadAnchorDescriptor, uploadAnchorField } from "@/components/MemoEditor/Editor/uploadAnchors";

const descriptor = (id: string): UploadAnchorDescriptor => ({
  id,
  status: "uploading",
  completed: 0,
  total: 1,
  message: "Uploading images 0/1",
  retryLabel: "Retry",
  keepLabel: "Keep as attachments",
  onRetry: vi.fn(),
  onKeepAttachments: vi.fn(),
});

const view = (doc = "") => new EditorView({ state: EditorState.create({ doc, extensions: [uploadAnchorField] }) });

describe("editor upload anchors", () => {
  it("maps the anchor through edits before resolving Markdown", () => {
    const editorView = view("alpha");
    const controller = createController(editorView, {} as never);
    controller.setCursor(5);
    controller.createUploadAnchor(descriptor("upload-one"));

    editorView.dispatch({ changes: { from: 0, insert: "X" } });
    controller.resolveUploadAnchor("upload-one", "![photo](/file/attachments/photo)");

    expect(controller.getMarkdown()).toBe("Xalpha\n\n![photo](/file/attachments/photo)");
    expect(editorView.dom.querySelector(".cm-upload-anchor")).toBeNull();
  });

  it("cancels an anchor without changing serialized Markdown", () => {
    const editorView = view("alpha");
    const controller = createController(editorView, {} as never);
    controller.createUploadAnchor(descriptor("upload-two"), 2);
    expect(editorView.dom.querySelector(".cm-upload-anchor")).not.toBeNull();

    controller.cancelUploadAnchor("upload-two");

    expect(controller.getMarkdown()).toBe("alpha");
    expect(editorView.dom.querySelector(".cm-upload-anchor")).toBeNull();
  });

  // The buttons that reach insertMarkdown live outside the editor, and CodeMirror
  // keeps its selection across blur, so an insert must not consume the range.
  it("inserts at the caret without replacing the selection", () => {
    const editorView = view("keep this paragraph of text");
    const controller = createController(editorView, {} as never);
    editorView.dispatch({ selection: { anchor: 5, head: 19 } });

    controller.insertMarkdown("![photo](/file/attachments/photo)");

    expect(controller.getMarkdown()).toBe("keep this paragraph\n\n![photo](/file/attachments/photo)\n\n of text");
  });

  it("re-renders the anchor when only its labels or callbacks change", () => {
    const editorView = view("alpha");
    const controller = createController(editorView, {} as never);
    const stale = vi.fn();
    controller.createUploadAnchor({ ...descriptor("upload-three"), status: "failed", onRetry: stale });

    const fresh = vi.fn();
    controller.updateUploadAnchor({ ...descriptor("upload-three"), status: "failed", message: "Retrying soon", onRetry: fresh });

    expect(editorView.dom.querySelector(".cm-upload-anchor-badge")?.textContent).toBe("Retrying soon");
    editorView.dom.querySelector<HTMLButtonElement>(".cm-upload-anchor-action")?.click();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });
});

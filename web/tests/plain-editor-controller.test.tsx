import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import PlainEditor from "@/components/MemoEditor/PlainEditor";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

function setup(initialContent = "") {
  const ref = createRef<EditorController>();
  render(
    <PlainEditor ref={ref} className="" initialContent={initialContent} placeholder="memo" onContentChange={vi.fn()} onPaste={vi.fn()} />,
  );
  const controller = ref.current as EditorController;
  const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
  return { controller, textarea };
}

describe("PlainEditor EditorController", () => {
  it("getMarkdown/setMarkdown mirror the textarea value", () => {
    const { controller, textarea } = setup("hello");
    expect(controller.getMarkdown()).toBe("hello");
    controller.setMarkdown("changed");
    expect(textarea.value).toBe("changed");
  });

  it("isEmpty treats whitespace-only content as empty", () => {
    const { controller } = setup("  \n ");
    expect(controller.isEmpty()).toBe(true);
  });

  it("insertMarkdown separates blocks with blank lines", () => {
    const { controller, textarea } = setup("first line");
    textarea.setSelectionRange(10, 10);
    controller.insertMarkdown("transcribed");
    expect(textarea.value).toBe("first line\n\ntranscribed");
  });

  // The raw textarea is an honest fallback with no rich-formatting capability
  // (controller.formatting is undefined); the focus-mode toolbar is WYSIWYG-only.
  it("exposes no formatting capability", () => {
    const { controller } = setup("x");
    expect(controller.formatting).toBeUndefined();
  });

  it("insertMarkdown with an empty string is a no-op", () => {
    const { controller, textarea } = setup("unchanged");
    textarea.setSelectionRange(0, 9);
    controller.insertMarkdown("");
    expect(textarea.value).toBe("unchanged");
  });

  it("hasFocus reflects the active element", () => {
    const { controller, textarea } = setup("x");
    expect(controller.hasFocus()).toBe(false);
    textarea.focus();
    expect(controller.hasFocus()).toBe(true);
  });
});

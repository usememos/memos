import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor, { type EditorRefActions } from "@/components/MemoEditor/Editor";
import { createTextareaController } from "@/components/MemoEditor/Editor/controllerAdapter";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({ default: () => null }));

function setup(initialContent = "") {
  const ref = createRef<EditorRefActions>();
  render(
    <Editor
      ref={ref}
      className=""
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={vi.fn()}
      onPaste={vi.fn()}
    />,
  );
  const controller = createTextareaController(() => ref.current);
  const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
  return { controller, textarea };
}

describe("textarea EditorController adapter", () => {
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

  it("toggleBold wraps the selection in **", () => {
    const { controller, textarea } = setup("read the docs");
    textarea.setSelectionRange(9, 13);
    controller.toggleBold();
    expect(textarea.value).toBe("read the **docs**");
  });

  it("toggleTaskList prefixes and unprefixes the current line", () => {
    const { controller, textarea } = setup("buy milk");
    textarea.setSelectionRange(4, 4);
    controller.toggleTaskList();
    expect(textarea.value).toBe("- [ ] buy milk");
    controller.toggleTaskList();
    expect(textarea.value).toBe("buy milk");
  });

  it("toggleTaskList unprefixes a checked task line", () => {
    const { controller, textarea } = setup("- [x] done thing");
    textarea.setSelectionRange(8, 8);
    controller.toggleTaskList();
    expect(textarea.value).toBe("done thing");
  });

  it("toggleTaskList preserves indentation", () => {
    const { controller, textarea } = setup("  nested item");
    textarea.setSelectionRange(4, 4);
    controller.toggleTaskList();
    expect(textarea.value).toBe("  - [ ] nested item");
    controller.toggleTaskList();
    expect(textarea.value).toBe("  nested item");
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

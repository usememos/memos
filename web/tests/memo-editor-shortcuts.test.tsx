import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({
  default: () => null,
}));

function renderEditor(initialContent: string, isInIME = false) {
  render(
    <Editor
      className=""
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={vi.fn()}
      onPaste={vi.fn()}
      isInIME={isInIME}
    />,
  );
  return screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
}

describe("memo editor markdown shortcuts", () => {
  describe("Ctrl+B (bold)", () => {
    it("wraps selected text with **", () => {
      const textarea = renderEditor("read the docs");
      textarea.setSelectionRange(9, 13);

      fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });

      expect(textarea).toHaveValue("read the **docs**");
    });

    it("removes ** from already-bolded text", () => {
      const textarea = renderEditor("read the **docs**");
      textarea.setSelectionRange(9, 17);

      fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });

      expect(textarea).toHaveValue("read the docs");
    });

    it("works with metaKey (Mac Cmd+B)", () => {
      const textarea = renderEditor("read the docs");
      textarea.setSelectionRange(9, 13);

      fireEvent.keyDown(textarea, { key: "b", metaKey: true });

      expect(textarea).toHaveValue("read the **docs**");
    });
  });

  describe("Ctrl+I (italic)", () => {
    it("wraps selected text with *", () => {
      const textarea = renderEditor("read the docs");
      textarea.setSelectionRange(9, 13);

      fireEvent.keyDown(textarea, { key: "i", ctrlKey: true });

      expect(textarea).toHaveValue("read the *docs*");
    });

    it("removes * from already-italicized text", () => {
      const textarea = renderEditor("read the *docs*");
      textarea.setSelectionRange(9, 15);

      fireEvent.keyDown(textarea, { key: "i", ctrlKey: true });

      expect(textarea).toHaveValue("read the docs");
    });

    it("works with metaKey (Mac Cmd+I)", () => {
      const textarea = renderEditor("read the docs");
      textarea.setSelectionRange(9, 13);

      fireEvent.keyDown(textarea, { key: "i", metaKey: true });

      expect(textarea).toHaveValue("read the *docs*");
    });

    it("preserves bold when italicizing already-bolded text", () => {
      const textarea = renderEditor("read the **docs**");
      textarea.setSelectionRange(9, 17);

      fireEvent.keyDown(textarea, { key: "i", ctrlKey: true });

      expect(textarea).toHaveValue("read the ***docs***");
    });
  });

  describe("shortcuts suppressed during IME composition", () => {
    it("does not apply bold during IME input", () => {
      const textarea = renderEditor("テスト", true);
      textarea.setSelectionRange(0, 3);

      fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });

      expect(textarea).toHaveValue("テスト");
    });
  });

  describe("no modifier key — no action", () => {
    it("does not apply bold when Ctrl/Cmd is not held", () => {
      const textarea = renderEditor("read the docs");
      textarea.setSelectionRange(9, 13);

      fireEvent.keyDown(textarea, { key: "b" });

      expect(textarea).toHaveValue("read the docs");
    });
  });
});

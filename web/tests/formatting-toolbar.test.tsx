import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FormattingToolbar } from "@/components/MemoEditor/components/FormattingToolbar";
import { type ActiveFormatState, EMPTY_ACTIVE_FORMATS } from "@/components/MemoEditor/Editor/editorCommands";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

// Match the repo convention: t echoes the i18n key (no i18next backend in tests),
// so accessible names below are the keys themselves.
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

// Radix DropdownMenu reaches for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function makeController(opts: { active?: Partial<ActiveFormatState>; getSelectedText?: () => string } = {}) {
  const run = vi.fn();
  const activeFormats: ActiveFormatState = { ...EMPTY_ACTIVE_FORMATS, ...opts.active };
  const controller: EditorController = {
    focus: () => {},
    hasFocus: () => false,
    isEmpty: () => true,
    getMarkdown: () => "",
    setMarkdown: () => {},
    insertMarkdown: vi.fn(),
    scrollToCursor: () => {},
    selectAll: () => {},
    formatting: {
      run,
      getActiveFormats: () => activeFormats,
      getSelectedText: opts.getSelectedText ?? (() => ""),
      subscribe: () => () => {},
    },
  };
  return { controller, run };
}

function renderToolbar(controller: EditorController, onExit = vi.fn()) {
  const ref = createRef<EditorController>();
  ref.current = controller;
  render(<FormattingToolbar controllerRef={ref} onExit={onExit} />);
  return { onExit };
}

describe("FormattingToolbar", () => {
  it("runs the bold command when the bold button is clicked", () => {
    const { controller, run } = makeController();
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.bold" }));
    expect(run).toHaveBeenCalledWith("bold");
  });

  it("runs the heading command when a heading level is chosen", () => {
    const { controller, run } = makeController();
    renderToolbar(controller);
    // Keyboard open is the most reliable path for Radix menus in jsdom.
    fireEvent.keyDown(screen.getByRole("button", { name: "editor.format.heading" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "editor.format.heading-2" }));
    expect(run).toHaveBeenCalledWith("heading2");
  });

  it("reflects active marks via aria-pressed", () => {
    const { controller } = makeController({ active: { bold: true } });
    renderToolbar(controller);
    expect(screen.getByRole("button", { name: "editor.format.bold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "editor.format.italic" })).toHaveAttribute("aria-pressed", "false");
  });

  it("prompts for a URL and links the selection when adding a link", () => {
    const { controller, run } = makeController({ getSelectedText: () => "memos" });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("https://usememos.com");
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.link" }));
    expect(run).toHaveBeenCalledWith("link", { url: "https://usememos.com" });
    promptSpy.mockRestore();
  });

  it("removes an active link without prompting", () => {
    const { controller, run } = makeController({ active: { link: true } });
    const promptSpy = vi.spyOn(window, "prompt");
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.link" }));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith("link");
    promptSpy.mockRestore();
  });

  it("calls onExit when the exit button is clicked", () => {
    const { controller } = makeController();
    const { onExit } = renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.exit-focus-mode" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

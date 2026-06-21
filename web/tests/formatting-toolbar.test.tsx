import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FormattingToolbar } from "@/components/MemoEditor/components/FormattingToolbar";
import type { EditorController, FormattingController } from "@/components/MemoEditor/types/editorController";

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

type Handle = EditorController & FormattingController;

function makeController(overrides: Partial<Handle> = {}): Handle {
  const noop = () => {};
  return {
    focus: noop,
    hasFocus: () => false,
    isEmpty: () => true,
    getMarkdown: () => "",
    setMarkdown: noop,
    insertMarkdown: noop,
    scrollToCursor: noop,
    selectAll: noop,
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleTaskList: vi.fn(),
    toggleCode: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    setHeading: vi.fn(),
    setParagraph: vi.fn(),
    toggleLink: vi.fn(),
    getSelectedText: () => "",
    isActive: () => false,
    subscribe: () => () => {},
    ...overrides,
  };
}

function renderToolbar(controller: Handle, onExit = vi.fn()) {
  const ref = createRef<Handle>();
  ref.current = controller;
  render(<FormattingToolbar controllerRef={ref} onExit={onExit} />);
  return { onExit };
}

describe("FormattingToolbar", () => {
  it("invokes toggleBold when the bold button is clicked", () => {
    const controller = makeController();
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.bold" }));
    expect(controller.toggleBold).toHaveBeenCalledTimes(1);
  });

  it("invokes setHeading when a heading level is chosen", () => {
    const controller = makeController();
    renderToolbar(controller);
    // Keyboard open is the most reliable path for Radix menus in jsdom.
    fireEvent.keyDown(screen.getByRole("button", { name: "editor.format.heading" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "editor.format.heading-2" }));
    expect(controller.setHeading).toHaveBeenCalledWith(2);
  });

  it("reflects active marks via aria-pressed", () => {
    const controller = makeController({ isActive: (name) => name === "bold" });
    renderToolbar(controller);
    expect(screen.getByRole("button", { name: "editor.format.bold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "editor.format.italic" })).toHaveAttribute("aria-pressed", "false");
  });

  it("prompts for a URL and links the selection when adding a link", () => {
    const controller = makeController({ getSelectedText: () => "memos" });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("https://usememos.com");
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.link" }));
    expect(controller.toggleLink).toHaveBeenCalledWith("https://usememos.com");
    promptSpy.mockRestore();
  });

  it("removes an active link without prompting", () => {
    const controller = makeController({ isActive: (name) => name === "link" });
    const promptSpy = vi.spyOn(window, "prompt");
    renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.format.link" }));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(controller.toggleLink).toHaveBeenCalledWith();
    promptSpy.mockRestore();
  });

  it("calls onExit when the exit button is clicked", () => {
    const controller = makeController();
    const { onExit } = renderToolbar(controller);
    fireEvent.click(screen.getByRole("button", { name: "editor.exit-focus-mode" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

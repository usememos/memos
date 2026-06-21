import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";
import type { EditorController, FormattingController } from "@/components/MemoEditor/types/editorController";

vi.mock("@/hooks/useUserQueries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTagCounts: () => ({ data: {} }),
}));

type Handle = EditorController & FormattingController;

function setup(initialContent = "") {
  const ref = createRef<Handle>();
  render(<Editor ref={ref} initialContent={initialContent} placeholder="memo" onContentChange={vi.fn()} onPaste={vi.fn()} />);
  return ref;
}

describe("FormattingController (WYSIWYG)", () => {
  it("toggleCode wraps the selection in inline code", () => {
    const ref = setup("code me");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleCode());
    expect(ref.current?.getMarkdown()).toBe("`code me`");
  });

  it("toggleBulletList converts the current block", () => {
    const ref = setup("item");
    act(() => ref.current?.toggleBulletList());
    expect(ref.current?.getMarkdown()).toBe("- item");
  });

  it("toggleOrderedList converts the current block", () => {
    const ref = setup("item");
    act(() => ref.current?.toggleOrderedList());
    expect(ref.current?.getMarkdown()).toBe("1. item");
  });

  it("setHeading makes the block a heading and isActive reflects the level", () => {
    const ref = setup("title");
    act(() => ref.current?.setHeading(2));
    expect(ref.current?.getMarkdown()).toBe("## title");
    expect(ref.current?.isActive("heading", { level: 2 })).toBe(true);
    expect(ref.current?.isActive("heading", { level: 1 })).toBe(false);
  });

  it("setParagraph reverts a heading", () => {
    const ref = setup("# title");
    act(() => ref.current?.setParagraph());
    expect(ref.current?.getMarkdown()).toBe("title");
  });

  it("isActive('bold') tracks the bold mark", () => {
    const ref = setup("x");
    expect(ref.current?.isActive("bold")).toBe(false);
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleBold());
    expect(ref.current?.isActive("bold")).toBe(true);
  });

  it("toggleLink applies a link over the selection, and removes it when active", () => {
    const ref = setup("memos");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleLink("https://usememos.com"));
    expect(ref.current?.getMarkdown()).toBe("[memos](https://usememos.com)");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleLink());
    expect(ref.current?.getMarkdown()).toBe("memos");
  });

  it("getSelectedText returns the current selection text", () => {
    const ref = setup("hello world");
    act(() => ref.current?.selectAll());
    expect(ref.current?.getSelectedText()).toBe("hello world");
  });

  it("subscribe fires on transactions and unsubscribe stops it", () => {
    const ref = setup("x");
    const listener = vi.fn();
    let unsubscribe = () => {};
    act(() => {
      unsubscribe = ref.current!.subscribe(listener);
    });
    act(() => ref.current?.selectAll());
    act(() => ref.current?.toggleBold());
    const callsWhileSubscribed = listener.mock.calls.length;
    expect(callsWhileSubscribed).toBeGreaterThan(0);
    act(() => unsubscribe());
    act(() => ref.current?.toggleItalic());
    expect(listener.mock.calls.length).toBe(callsWhileSubscribed);
  });
});

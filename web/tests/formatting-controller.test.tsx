import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

vi.mock("@/hooks/useUserQueries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTagCounts: () => ({ data: {} }),
}));

function setup(initialContent = "") {
  const ref = createRef<EditorController>();
  render(<Editor ref={ref} initialContent={initialContent} placeholder="memo" onContentChange={vi.fn()} onPaste={vi.fn()} />);
  return ref;
}

describe("WYSIWYG formatting capability", () => {
  it("the WYSIWYG editor exposes a formatting capability", () => {
    const ref = setup("x");
    expect(ref.current?.formatting).toBeDefined();
  });

  it("run('code') wraps the selection in inline code", () => {
    const ref = setup("code me");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("code"));
    expect(ref.current?.getMarkdown()).toBe("`code me`");
  });

  it("run('bulletList') converts the current block", () => {
    const ref = setup("item");
    act(() => ref.current?.formatting?.run("bulletList"));
    expect(ref.current?.getMarkdown()).toBe("- item");
  });

  it("run('orderedList') converts the current block", () => {
    const ref = setup("item");
    act(() => ref.current?.formatting?.run("orderedList"));
    expect(ref.current?.getMarkdown()).toBe("1. item");
  });

  it("run('heading2') makes the block a heading and getActiveFormats reflects the level", () => {
    const ref = setup("title");
    act(() => ref.current?.formatting?.run("heading2"));
    expect(ref.current?.getMarkdown()).toBe("## title");
    expect(ref.current?.formatting?.getActiveFormats().headingLevel).toBe(2);
  });

  it("run('paragraph') reverts a heading", () => {
    const ref = setup("# title");
    act(() => ref.current?.formatting?.run("paragraph"));
    expect(ref.current?.getMarkdown()).toBe("title");
  });

  it("getActiveFormats().bold tracks the bold mark", () => {
    const ref = setup("x");
    expect(ref.current?.formatting?.getActiveFormats().bold).toBe(false);
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("bold"));
    expect(ref.current?.formatting?.getActiveFormats().bold).toBe(true);
  });

  it("run('link') applies a link over the selection, and removes it when active", () => {
    const ref = setup("memos");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("link", { url: "https://usememos.com" }));
    expect(ref.current?.getMarkdown()).toBe("[memos](https://usememos.com)");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("link"));
    expect(ref.current?.getMarkdown()).toBe("memos");
  });

  it("getSelectedText returns the current selection text", () => {
    const ref = setup("hello world");
    act(() => ref.current?.selectAll());
    expect(ref.current?.formatting?.getSelectedText()).toBe("hello world");
  });

  it("subscribe fires on transactions and unsubscribe stops it", () => {
    const ref = setup("x");
    const listener = vi.fn();
    let unsubscribe = () => {};
    act(() => {
      unsubscribe = ref.current!.formatting!.subscribe(listener);
    });
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("bold"));
    const callsWhileSubscribed = listener.mock.calls.length;
    expect(callsWhileSubscribed).toBeGreaterThan(0);
    act(() => unsubscribe());
    act(() => ref.current?.formatting?.run("italic"));
    expect(listener.mock.calls.length).toBe(callsWhileSubscribed);
  });
});

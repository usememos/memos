import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlainEditor from "@/components/MemoEditor/PlainEditor";

function pastePlainText(textarea: HTMLTextAreaElement, text: string) {
  fireEvent.paste(textarea, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" || type === "text" ? text : ""),
    },
  });
}

function renderEditor(initialContent: string) {
  const onPaste = vi.fn();
  render(<PlainEditor className="" initialContent={initialContent} placeholder="memo" onContentChange={vi.fn()} onPaste={onPaste} />);

  return {
    onPaste,
    textarea: screen.getByPlaceholderText("memo") as HTMLTextAreaElement,
  };
}

describe("plain editor paste handling", () => {
  // The plain textarea does no in-editor paste transformation (no URL → link
  // wrapping); it forwards every paste to onPaste so the host can handle files.
  it("forwards pasted text to onPaste without altering the value", () => {
    const { onPaste, textarea } = renderEditor("read the docs");
    textarea.setSelectionRange(9, 13);

    pastePlainText(textarea, "https://example.com");

    expect(textarea).toHaveValue("read the docs");
    expect(onPaste).toHaveBeenCalledOnce();
  });
});

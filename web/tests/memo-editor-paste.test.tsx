import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({
  default: () => null,
}));

function pastePlainText(textarea: HTMLTextAreaElement, text: string) {
  fireEvent.paste(textarea, {
    clipboardData: {
      getData: (type: string) => (type === "text/plain" || type === "text" ? text : ""),
    },
  });
}

function renderEditor(initialContent: string) {
  const onPaste = vi.fn();
  render(
    <Editor
      className=""
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={vi.fn()}
      onPaste={onPaste}
    />,
  );

  return {
    onPaste,
    textarea: screen.getByPlaceholderText("memo") as HTMLTextAreaElement,
  };
}

describe("memo editor paste handling", () => {
  it("wraps selected text with a pasted URL", () => {
    const { onPaste, textarea } = renderEditor("read the docs");
    textarea.setSelectionRange(9, 13);

    pastePlainText(textarea, "https://example.com");

    expect(textarea).toHaveValue("read the [docs](https://example.com)");
    expect(textarea.selectionStart).toBe("read the [docs](https://example.com)".length);
    expect(textarea.selectionEnd).toBe("read the [docs](https://example.com)".length);
    expect(onPaste).not.toHaveBeenCalled();
  });

  it("delegates non-URL text paste", () => {
    const { onPaste, textarea } = renderEditor("read the docs");
    textarea.setSelectionRange(9, 13);

    pastePlainText(textarea, "not a url");

    expect(textarea).toHaveValue("read the docs");
    expect(onPaste).toHaveBeenCalledOnce();
  });

  it("delegates pasted URLs when no text is selected", () => {
    const { onPaste, textarea } = renderEditor("read the docs");
    textarea.setSelectionRange(13, 13);

    pastePlainText(textarea, "https://example.com");

    expect(textarea).toHaveValue("read the docs");
    expect(onPaste).toHaveBeenCalledOnce();
  });

  it("delegates pasted URLs when the selected text is already a URL", () => {
    const { onPaste, textarea } = renderEditor("https://memos.example");
    textarea.setSelectionRange(0, "https://memos.example".length);

    pastePlainText(textarea, "https://example.com");

    expect(textarea).toHaveValue("https://memos.example");
    expect(onPaste).toHaveBeenCalledOnce();
  });
});

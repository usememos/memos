import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";

vi.mock("@/components/MemoEditor/Editor/TagSuggestions", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoEditor/Editor/SlashCommands", () => ({
  default: () => null,
}));

function simulateKeyDown(textarea: HTMLTextAreaElement, key: string, shiftKey = false) {
  fireEvent.keyDown(textarea, {
    key,
    shiftKey,
    keyCode: key === "Tab" ? 9 : undefined,
    which: key === "Tab" ? 9 : undefined,
  });
}

function renderEditor(initialContent: string) {
  render(
    <Editor
      className=""
      initialContent={initialContent}
      placeholder="memo"
      onContentChange={vi.fn()}
      onPaste={vi.fn()}
    />,
  );
  return screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
}

describe("memo editor list indent (Tab/Shift+Tab)", () => {
  it("inserts 4 spaces on Tab when not on a list line", () => {
    const textarea = renderEditor("hello world");
    textarea.setSelectionRange(5, 5);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("hello     world");
    expect(textarea.selectionStart).toBe(9);
    expect(textarea.selectionEnd).toBe(9);
  });

  it("indents an unordered list item with Tab", () => {
    const textarea = renderEditor("- item");
    textarea.setSelectionRange(0, 0);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("    - item");
  });

  it("indents an unordered list item with spaces cannot be multiple of 4", () => {
    const textarea = renderEditor("  - item");
    textarea.setSelectionRange(0, 0);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("    - item");
  });

  it("dedents an indented unordered list item with Shift+Tab", () => {
    const textarea = renderEditor("    - item");
    textarea.setSelectionRange(6, 6);

    simulateKeyDown(textarea, "Tab", true);

    expect(textarea.value).toBe("- item");
  });

  it("indents an ordered list item and renumbers subsequent items", () => {
    const textarea = renderEditor("1. first\n2. second\n3. third");
    const secondLineStart = "1. first\n".length;
    textarea.setSelectionRange(secondLineStart + 4, secondLineStart + 4);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("1. first\n    1. second\n2. third");
  });

  it("dedents an indented ordered list item and renumbers", () => {
    const textarea = renderEditor("1. first\n    1. second\n2. third");
    const cursorAfterSedond = "1. first\n    1. second".length;
    textarea.setSelectionRange(cursorAfterSedond, cursorAfterSedond);

    simulateKeyDown(textarea, "Tab", true);

    expect(textarea.value).toBe("1. first\n2. second\n3. third");
  });

  it("indents a task list item with Tab preserving format", () => {
    const textarea = renderEditor("- [ ] todo item");
    textarea.setSelectionRange(6, 6);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("    - [ ] todo item");
  });

  it("preserves relative cursor position after indent", () => {
    const textarea = renderEditor("- item");
    const cursorAfterIt = "- it".length;
    textarea.setSelectionRange(cursorAfterIt, cursorAfterIt);

    simulateKeyDown(textarea, "Tab");

    expect(textarea.value).toBe("    - item");
    expect(textarea.selectionStart).toBe("- it".length + 4);
    expect(textarea.selectionEnd).toBe("- it".length + 4);
  });

  it("does not change an unindented list item on Shift+Tab", () => {
    const textarea = renderEditor("- item");
    textarea.setSelectionRange(4, 4);

    simulateKeyDown(textarea, "Tab", true);

    expect(textarea.value).toBe("- item");
  });

  it("renumbers nested lists independently per parent item", () => {
    const textarea = renderEditor("1. first\n    2. nested a\n2. second\n    3. nested b");

    const curosrBeforeNestedA = "1. first\n    2. ".length;
    textarea.setSelectionRange(curosrBeforeNestedA, curosrBeforeNestedA);

    simulateKeyDown(textarea, "Tab", true);

    expect(textarea.value).toBe("1. first\n2. nested a\n3. second\n    1. nested b");
  });

  it("preserve ordered-list counters across nested non-ordered lines.", () => {
    const textarea = renderEditor("1. first\n    - child\n2. second");

    const curosrBeforeNestedA = "1. first\n    - child".length;
    textarea.setSelectionRange(curosrBeforeNestedA, curosrBeforeNestedA);

    simulateKeyDown(textarea, "Tab", true);

    expect(textarea.value).toBe("1. first\n- child\n2. second");
  });

  it("preserves cursor position when renumbering changes marker width", () => {
    const textarea = renderEditor(
      "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n10. tenth",
    );

    const tenthLineStart = "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n".length;
    const cursorInTenthContent = tenthLineStart + "10. t".length;
    textarea.setSelectionRange(cursorInTenthContent, cursorInTenthContent);

    simulateKeyDown(textarea, "Tab");

    const newTenthLineStart = "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n".length;
    const expectedCursor = newTenthLineStart + "    1. t".length;
    expect(textarea.selectionStart).toBe(expectedCursor);
    expect(textarea.selectionEnd).toBe(expectedCursor);
  });

  it("preserves cursor position on Shift+Tab when renumbering widens the marker", () => {
    const textarea = renderEditor(
      "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n    1. tenth",
    );

    const tenthLineStart = "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n".length;
    const cursorInContent = tenthLineStart + "    1. t".length;
    textarea.setSelectionRange(cursorInContent, cursorInContent);

    simulateKeyDown(textarea, "Tab", true);

    const newTenthLineStart = "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n".length;
    const expectedCursor = newTenthLineStart + "10. t".length;
    expect(textarea.value).toBe(
      "1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n7. g\n8. h\n9. i\n10. tenth",
    );
    expect(textarea.selectionStart).toBe(expectedCursor);
    expect(textarea.selectionEnd).toBe(expectedCursor);
  });
});

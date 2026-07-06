import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: {} }),
}));

describe("Editor", () => {
  it("loads markdown and serializes it back verbatim", () => {
    const ref = createRef<EditorController>();
    render(
      <Editor
        ref={ref}
        className="x"
        initialContent={"# Title\n\n- a\n  1. b"}
        placeholder="memo"
        onContentChange={vi.fn()}
        onPaste={vi.fn()}
      />,
    );
    expect(ref.current?.getMarkdown()).toBe("# Title\n\n- a\n  1. b");
  });

  it("emits changes through onContentChange", () => {
    const ref = createRef<EditorController>();
    const onChange = vi.fn();
    render(<Editor ref={ref} className="x" initialContent="" placeholder="memo" onContentChange={onChange} onPaste={vi.fn()} />);
    ref.current?.setMarkdown("hello");
    expect(onChange).toHaveBeenCalledWith("hello");
  });
});

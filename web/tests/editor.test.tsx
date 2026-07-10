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
        onFiles={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(ref.current?.getMarkdown()).toBe("# Title\n\n- a\n  1. b");
  });

  it("emits changes through onContentChange", () => {
    const ref = createRef<EditorController>();
    const onChange = vi.fn();
    render(
      <Editor
        ref={ref}
        className="x"
        initialContent=""
        placeholder="memo"
        onContentChange={onChange}
        onFiles={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    ref.current?.setMarkdown("hello");
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("reconfigures the placeholder when its translation changes", () => {
    const props = {
      className: "x",
      initialContent: "",
      onContentChange: vi.fn(),
      onFiles: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { container, rerender } = render(<Editor {...props} placeholder="Any thoughts?" />);

    expect(container.querySelector(".cm-content")).toHaveAttribute("aria-placeholder", "Any thoughts?");
    expect(container.querySelector(".cm-placeholder")).toHaveTextContent("Any thoughts?");

    rerender(<Editor {...props} placeholder="有什么想法？" />);

    expect(container.querySelector(".cm-content")).toHaveAttribute("aria-placeholder", "有什么想法？");
    expect(container.querySelector(".cm-placeholder")).toHaveTextContent("有什么想法？");
  });
});

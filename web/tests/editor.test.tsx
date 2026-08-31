import { fireEvent, render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/Editor";
import type { EditorController } from "@/components/MemoEditor/types/editorController";

const queries = vi.hoisted(() => ({
  useTagCounts: vi.fn(() => ({ data: {} })),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: queries.useTagCounts,
}));

describe("Editor", () => {
  it("scopes tag autocomplete stats to the current user", () => {
    render(<Editor className="x" initialContent="" placeholder="memo" onContentChange={vi.fn()} onFiles={vi.fn()} onSubmit={vi.fn()} />);

    expect(queries.useTagCounts).toHaveBeenCalledWith(true);
  });

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

  it("does not replace newer editor text with a stale local echo", () => {
    const ref = createRef<EditorController>();
    const props = {
      ref,
      className: "x",
      placeholder: "memo",
      onContentChange: vi.fn(),
      onFiles: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { rerender } = render(<Editor {...props} initialContent="" />);

    ref.current?.setMarkdown("H");
    ref.current?.setMarkdown("Hello");
    rerender(<Editor {...props} initialContent="H" contentIsExternal={false} />);

    expect(ref.current?.getMarkdown()).toBe("Hello");
  });

  it("defers external content until an IME composition ends", async () => {
    const ref = createRef<EditorController>();
    const onChange = vi.fn();
    const onExternalContentApplied = vi.fn();
    const props = {
      ref,
      className: "x",
      placeholder: "memo",
      onContentChange: onChange,
      onExternalContentApplied,
      onFiles: vi.fn(),
      onSubmit: vi.fn(),
      contentIsExternal: true,
    };
    const { container, rerender } = render(<Editor {...props} initialContent="" />);
    const content = container.querySelector<HTMLElement>(".cm-content");
    expect(content).not.toBeNull();

    fireEvent.compositionStart(content!);
    rerender(<Editor {...props} initialContent="server value" />);
    expect(ref.current?.getMarkdown()).toBe("");

    // A final IME transaction can arrive after the external value entered the
    // store. The deferred external value must still win at compositionend.
    ref.current?.setMarkdown("local composition value");
    expect(onChange).toHaveBeenLastCalledWith("local composition value");
    fireEvent.compositionEnd(content!);

    await waitFor(() => expect(ref.current?.getMarkdown()).toBe("server value"));
    expect(onExternalContentApplied).toHaveBeenLastCalledWith("server value");
    expect(onChange).not.toHaveBeenCalledWith("server value");
  });

  it("enables native text assistance for prose input", () => {
    const props = {
      className: "x",
      initialContent: "",
      placeholder: "memo",
      onContentChange: vi.fn(),
      onFiles: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { container } = render(<Editor {...props} />);

    const content = container.querySelector(".cm-content");
    expect(content).toHaveAttribute("autocorrect", "on");
    expect(content).toHaveAttribute("autocapitalize", "on");
    expect(content).toHaveAttribute("spellcheck", "true");
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

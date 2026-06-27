import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/components/EditorContent";
import { EditorProvider, useEditorContext, useEditorSelector } from "@/components/MemoEditor/state";

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: {} }),
}));

// useTranslate returns the key string in tests (no i18next backend initialised).
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

function ModeProbe() {
  const { actions, dispatch } = useEditorContext();
  const editorMode = useEditorSelector((s) => s.ui.editorMode);
  return (
    <>
      <button
        type="button"
        data-testid="probe-toggle"
        onClick={() => dispatch(actions.setEditorMode(editorMode === "wysiwyg" ? "raw" : "wysiwyg"))}
      >
        {editorMode}
      </button>
      <button type="button" data-testid="probe-set-content" onClick={() => dispatch(actions.updateContent("from **wysiwyg**"))}>
        set content
      </button>
    </>
  );
}

function renderDualEditor() {
  render(
    <EditorProvider>
      <EditorContent placeholder="memo" />
      <ModeProbe />
    </EditorProvider>,
  );
}

describe("editor mode switching", () => {
  it("mounts the WYSIWYG editor by default", () => {
    localStorage.clear();
    renderDualEditor();
    expect(document.querySelector(".memo-wysiwyg")).not.toBeNull();
    expect(screen.queryByPlaceholderText("memo")).toBeNull();
  });

  it("mounts the textarea when the persisted preference is raw", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderDualEditor();
    expect(screen.getByPlaceholderText("memo")).toBeInTheDocument();
    expect(document.querySelector(".memo-wysiwyg")).toBeNull();
  });

  it("hands content across when toggling raw → wysiwyg", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderDualEditor();
    const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hello **world**" } });

    fireEvent.click(screen.getByTestId("probe-toggle"));

    const wysiwyg = document.querySelector(".memo-wysiwyg");
    expect(wysiwyg).not.toBeNull();
    expect(wysiwyg?.textContent).toContain("hello world");
    expect(wysiwyg?.querySelector("strong")?.textContent).toBe("world");
  });

  it("hands content across when toggling wysiwyg → raw", () => {
    localStorage.clear();
    renderDualEditor();
    // Seed content through the reducer exactly as the wysiwyg editor would.
    act(() => {
      fireEvent.click(screen.getByTestId("probe-set-content"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("probe-toggle"));
    });
    const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
    expect(textarea.value).toBe("from **wysiwyg**");
  });

  it("double toggle round-trips content byte-identically", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    renderDualEditor();
    const textarea = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "- [ ] task one\n\nsome **bold** text" } });
    act(() => {
      fireEvent.click(screen.getByTestId("probe-toggle")); // raw → wysiwyg
    });
    act(() => {
      fireEvent.click(screen.getByTestId("probe-toggle")); // wysiwyg → raw
    });
    const textareaAfter = screen.getByPlaceholderText("memo") as HTMLTextAreaElement;
    expect(textareaAfter.value).toBe("- [ ] task one\n\nsome **bold** text");
  });

  it("focuses the incoming editor after a toggle", () => {
    localStorage.setItem("memos-editor-mode", "raw");
    // The WYSIWYG editor's focus command schedules the actual DOM focus via
    // requestAnimationFrame. Mock rAF to fire synchronously so we can assert
    // that HTMLElement.prototype.focus() was called within the act() boundary.
    const pendingRafs: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pendingRafs.push(cb);
      return pendingRafs.length;
    });
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    renderDualEditor();
    focusSpy.mockClear();
    pendingRafs.length = 0; // clear any rAF calls from initial render

    act(() => {
      fireEvent.click(screen.getByTestId("probe-toggle")); // raw → wysiwyg
    });
    // Flush pending animation frames (captures the editor's deferred view.focus()).
    act(() => {
      pendingRafs.splice(0).forEach((cb) => cb(0));
    });

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
    rafSpy.mockRestore();
  });
});

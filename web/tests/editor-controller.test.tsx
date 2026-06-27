import { act, fireEvent, render } from "@testing-library/react";
import type { Editor as EditorInstance } from "@tiptap/core";
import { AllSelection } from "@tiptap/pm/state";
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
  const onContentChange = vi.fn();
  const { container } = render(
    <Editor ref={ref} initialContent={initialContent} placeholder="memo" onContentChange={onContentChange} onPaste={vi.fn()} />,
  );
  // The editor instance is exposed on the ProseMirror DOM node; tests use it
  // only where the EditorController surface cannot produce the state.
  const editor = (container.querySelector(".ProseMirror") as HTMLElement & { editor?: EditorInstance }).editor as EditorInstance;
  return { ref, onContentChange, editor };
}

// Like setup(), but exposes a rerender(content) that re-renders the SAME
// component instance with a new initialContent — the external-sync path.
function setupRerenderable(initialContent = "") {
  const ref = createRef<EditorController>();
  const onContentChange = vi.fn();
  const renderEditor = (content: string) => (
    <Editor ref={ref} initialContent={content} placeholder="memo" onContentChange={onContentChange} onPaste={vi.fn()} />
  );
  const { rerender: rtlRerender } = render(renderEditor(initialContent));
  const rerender = (content: string) => act(() => rtlRerender(renderEditor(content)));
  return { ref, onContentChange, rerender };
}

describe("Editor EditorController", () => {
  it("loads markdown and serializes it back", () => {
    const { ref } = setup("# Title\n\nSome **bold** text.");
    expect(ref.current?.getMarkdown()).toBe("# Title\n\nSome **bold** text.");
  });

  it("reports emptiness", () => {
    const { ref } = setup("");
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("treats whitespace-only content as empty", () => {
    // Markdown parsing can never produce a whitespace-only text node, so type
    // the spaces through a raw ProseMirror transaction the way a user would.
    const { ref, editor } = setup("");
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText("   ", 1));
    });
    expect(editor.isEmpty).toBe(false); // structurally non-empty...
    expect(ref.current?.isEmpty()).toBe(true); // ...but empty per the contract
  });

  it("setMarkdown replaces the document", () => {
    const { ref } = setup("old");
    act(() => ref.current?.setMarkdown("- [ ] task"));
    expect(ref.current?.getMarkdown()).toBe("- [ ] task");
  });

  it("insertMarkdown adds content and notifies onContentChange", () => {
    const { ref, onContentChange } = setup("");
    act(() => ref.current?.insertMarkdown("hello"));
    expect(ref.current?.getMarkdown()).toContain("hello");
    expect(onContentChange).toHaveBeenCalledWith(expect.stringContaining("hello"));
  });

  it("formatting.run('bold') bolds the selected text", () => {
    const { ref } = setup("bold me");
    act(() => ref.current?.selectAll());
    act(() => ref.current?.formatting?.run("bold"));
    expect(ref.current?.getMarkdown()).toBe("**bold me**");
  });

  it("formatting.run('taskList') converts the current block", () => {
    const { ref } = setup("buy milk");
    act(() => ref.current?.formatting?.run("taskList"));
    expect(ref.current?.getMarkdown()).toBe("- [ ] buy milk");
  });
});

describe("tag suggestion insertion", () => {
  it("tag suggestion command inserts tag-marked text plus an unmarked space", () => {
    const { ref, editor } = setup("");
    act(() => {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: 1, to: 1 }, [
          { type: "text", text: "#alpha", marks: [{ type: "tag", attrs: { tag: "alpha" } }] },
          { type: "text", text: " " },
        ])
        .run();
    });
    expect(ref.current?.getMarkdown()).toBe("#alpha");
    const para = editor.getJSON().content?.[0];
    expect(para?.content?.[0]).toMatchObject({ text: "#alpha", marks: [{ type: "tag" }] });
    expect(para?.content?.[1]?.marks ?? []).toHaveLength(0);
  });
});

describe("tag escaping", () => {
  // Drives the ProseMirror input-rules plugin the way real typing does:
  // someProp("handleTextInput", …) is exactly what the view calls on keystroke.
  function typeText(editor: EditorInstance, text: string) {
    const { from } = editor.state.selection;
    editor.view.someProp("handleTextInput", (handler) => handler(editor.view, from, from, text));
  }

  it("undoing the tag autoformat leaves a durable literal #tag, not a pill", () => {
    const { ref, editor } = setup("");
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText("#NAS", 1));
    });
    act(() => typeText(editor, " ")); // tag input rule fires → pill
    act(() => {
      editor.commands.undoInputRule(); // the standard "I didn't want that" gesture
    });

    // Back to plain text — and the serializer escapes it so it can't re-tag.
    expect(ref.current?.getMarkdown()?.trim()).toBe("\\#NAS");
    const para = editor.getJSON().content?.[0];
    expect(para?.content?.some((n) => (n.marks ?? []).some((m) => m.type === "tag"))).toBeFalsy();
  });

  it("a plain #tag still becomes a tag", () => {
    const { ref, editor } = setup("");
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText("#work", 1));
    });
    act(() => typeText(editor, " "));

    expect(ref.current?.getMarkdown()?.trim()).toBe("#work");
    const para = editor.getJSON().content?.[0];
    expect(para?.content?.[0]).toMatchObject({ text: "#work", marks: [{ type: "tag" }] });
  });
});

describe("external content sync", () => {
  it("a trim-equal echo of the editor's own output does not reset the document", () => {
    const { ref, rerender } = setupRerenderable("hello");
    // simulate parent echoing back the serialized value
    rerender("hello");
    expect(ref.current?.getMarkdown()).toBe("hello");
  });

  it("a genuinely external change replaces the document without emitting onContentChange", () => {
    const { ref, onContentChange, rerender } = setupRerenderable("old");
    rerender("# new");
    expect(ref.current?.getMarkdown()).toBe("# new");
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("reset-to-empty clears the editor", () => {
    const { ref, rerender } = setupRerenderable("something");
    rerender("");
    expect(ref.current?.isEmpty()).toBe(true);
  });
});

describe("keyboard shortcuts", () => {
  it("Mod-Enter does not insert a hard break (reserved for app-level save)", () => {
    // ProseMirror attaches its keydown listener directly on the contenteditable
    // (.ProseMirror) element. fireEvent.keyDown dispatches a real DOM event
    // that triggers PM's handler → keymap plugin resolution → our
    // SaveShortcutPassthrough extension (priority 1000) returns true before
    // HardBreak's handler runs, so no document mutation occurs.
    //
    // Non-vacuousness proof: the parallel Shift-Enter test below uses the same
    // dispatch path and DOES mutate the document, confirming that fireEvent.keyDown
    // reaches ProseMirror's keymap in jsdom.
    const { ref, editor } = setup("hello");
    const proseMirrorEl = document.querySelector(".ProseMirror") as HTMLElement;
    const docBefore = editor.state.doc.toString();
    act(() => {
      fireEvent.keyDown(proseMirrorEl, { key: "Enter", ctrlKey: true });
    });
    expect(editor.state.doc.toString()).toBe(docBefore);
    expect(ref.current?.getMarkdown()).toBe("hello");
  });

  it("Shift-Enter still inserts a hard break (proves fireEvent.keyDown reaches PM keymap)", () => {
    // Positive control: the same keydown dispatch path DOES mutate the document
    // when it reaches HardBreak's handler (Shift-Enter is not intercepted by
    // SaveShortcutPassthrough, which only swallows Mod-Enter).
    // This confirms the Mod-Enter test above is not vacuous.
    const { ref, editor } = setup("hello");
    // Select all first so the cursor is in a known position and PM's
    // setHardBreak command can execute (requires a text selection).
    act(() => {
      editor.commands.selectAll();
    });
    const proseMirrorEl = document.querySelector(".ProseMirror") as HTMLElement;
    const docBefore = editor.state.doc.toString();
    act(() => {
      fireEvent.keyDown(proseMirrorEl, { key: "Enter", shiftKey: true });
    });
    // A hardBreak node must have been inserted — the document changed.
    expect(editor.state.doc.toString()).not.toBe(docBefore);
    expect(editor.state.doc.toString()).toContain("hardBreak");
    // The serialized markdown now contains a hard break (two trailing spaces + newline).
    expect(ref.current?.getMarkdown()).not.toBe("hello");
  });
});

describe("select-all then delete", () => {
  it("collapses to a caret instead of leaving a highlighted empty block", () => {
    // Repro of the reported bug: Ctrl+A makes an AllSelection, Backspace empties
    // the document. AllSelection.map() always returns another AllSelection, so
    // without intervention the selection is left as a non-empty whole-document
    // AllSelection over the empty paragraph — which the view paints as a
    // "selected" empty block (the screenshot artifact).
    const { ref, editor } = setup("hello world");
    const proseMirrorEl = document.querySelector(".ProseMirror") as HTMLElement;
    act(() => {
      editor.commands.selectAll();
    });
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
    act(() => {
      fireEvent.keyDown(proseMirrorEl, { key: "Backspace" });
    });
    expect(ref.current?.isEmpty()).toBe(true);
    // The fix: the leftover selection must be a collapsed caret, never a
    // lingering non-empty AllSelection.
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection).not.toBeInstanceOf(AllSelection);
  });

  it("deleting an all-selection via the deleteSelection command also collapses (covers Cut)", () => {
    // Cut (Cmd-X) and programmatic deletes go through deleteSelection rather
    // than the Backspace keymap, but hit the same AllSelection.map() trap.
    const { ref, editor } = setup("# Title\n\nsome **bold** text");
    act(() => {
      editor.commands.selectAll();
    });
    act(() => {
      editor.commands.deleteSelection();
    });
    expect(ref.current?.isEmpty()).toBe(true);
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection).not.toBeInstanceOf(AllSelection);
  });
});

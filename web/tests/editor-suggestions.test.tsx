import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/components/EditorContent";
import { EditorSuggestions, SuggestionsBar } from "@/components/MemoEditor/components/EditorSuggestions";
import { createInitialState, EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import type { EditorController } from "@/components/MemoEditor/types/editorController";
import { getMemoSuggestions, type MemoSuggestion } from "@/lib/memo-suggestions";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => undefined }));

let editor: ReturnType<typeof useEditorContext>;
let controller: React.RefObject<EditorController | null>;
const candidates = getMemoSuggestions(["work", "release", "planning", "later"].map((value) => ({ factor: "tagSearch", value })));

function Harness({ suggestions, space }: { suggestions: MemoSuggestion[]; space?: string }) {
  editor = useEditorContext();
  controller = useRef<EditorController>(null);
  return (
    <>
      <EditorContent ref={controller} onSubmit={vi.fn()} onFiles={vi.fn()} />
      <EditorSuggestions suggestions={suggestions} controllerRef={controller} space={space} />
    </>
  );
}

function composer(suggestions = candidates, content = "A note", space?: string) {
  return (
    <EditorProvider initialEditorState={{ ...createInitialState(), content }}>
      <Harness suggestions={suggestions} space={space} />
    </EditorProvider>
  );
}

describe("editor suggestions", () => {
  it.each(["", " \n\t "])("shows suggestions only after writing content, and hides them when cleared: %j", (content) => {
    render(composer(candidates, content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A thought"));
    expect(screen.getByRole("group", { name: "editor.suggestions" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown(content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("uses a payload-agnostic bar with dashed buttons", () => {
    const onAccept = vi.fn();
    render(<SuggestionsBar suggestions={[{ id: "future:example", label: "Example" }]} disabled={false} onAccept={onAccept} />);
    const chip = screen.getByRole("button", { name: "Example" });
    expect(chip).toHaveClass("border-dashed");
    fireEvent.click(chip);
    expect(onAccept).toHaveBeenCalledWith("future:example");
  });

  it("shows at most three and fills the vacated slot after acceptance", () => {
    render(composer());
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "common.add #later" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.add #work" }));
    expect(editor.getState().content).toBe("#work A note");
    expect(screen.queryByRole("button", { name: "common.add #work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add #later" })).toBeInTheDocument();
    expect(controller.current?.hasFocus()).toBe(true);
  });

  it("inserts at the remembered caret when a chip takes focus", () => {
    render(composer(candidates, "Before after"));
    act(() => controller.current?.setCursor(7));
    const chip = screen.getByRole("button", { name: "common.add #work" });
    act(() => chip.focus());
    fireEvent.click(chip);
    expect(editor.getState().content).toBe("Before #work after");
    expect(controller.current?.getCursor()).toBe(13);
    expect(controller.current?.hasFocus()).toBe(true);
  });

  it("hides tags in restored and manually edited content, but not inside code", () => {
    render(composer(candidates, "#work\n\n`#release`"));
    expect(screen.queryByRole("button", { name: "common.add #work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add #release" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown("#work #release"));
    expect(screen.queryByRole("button", { name: "common.add #release" })).not.toBeInTheDocument();
  });

  it("retains acceptance across removal and context changes, then clears it for a fresh draft", () => {
    const result = render(composer());
    fireEvent.click(screen.getByRole("button", { name: "common.add #work" }));
    act(() => controller.current?.setMarkdown("A note"));
    result.rerender(composer([candidates[0]]));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(controller.current?.getMarkdown()).toBe("A note");
    act(() => editor.dispatch(editor.actions.reset()));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A fresh thought"));
    expect(screen.getByRole("button", { name: "common.add #work" })).toBeInTheDocument();
  });

  it("leaves accepted text intact when context changes and prevents insertion during save", () => {
    const result = render(composer());
    fireEvent.click(screen.getByRole("button", { name: "common.add #work" }));
    result.rerender(composer([candidates[1]]));
    expect(controller.current?.getMarkdown()).toBe("#work A note");
    act(() => editor.dispatch(editor.actions.setLoading("saving", true)));
    const chip = screen.getByRole("button", { name: "common.add #release" });
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(controller.current?.getMarkdown()).toBe("#work A note");
  });

  it("hides the whole row when nothing applies", () => {
    render(composer([], "A note"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

const checklist: MemoSuggestion = { id: "checklist", kind: "checklist", source: "view" };
const publicAudience: MemoSuggestion = { id: "visibility:PUBLIC", kind: "visibility", visibility: Visibility.PUBLIC, source: "view" };
const spaceAudience: MemoSuggestion = { id: "visibility:SPACE", kind: "visibility", visibility: Visibility.SPACE, source: "view" };

describe("checklist and visibility acceptance", () => {
  it("formats the remembered cursor line and retains acceptance after removal", () => {
    render(composer([checklist], "First\nSecond"));
    act(() => controller.current?.setCursor(8));
    const chip = screen.getByRole("button", { name: "editor.format.task-list" });
    act(() => chip.focus());
    fireEvent.click(chip);
    expect(editor.getState().content).toBe("First\n- [ ] Second");
    expect(controller.current?.hasFocus()).toBe(true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("First\nSecond"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.reset()));
    act(() => controller.current?.setMarkdown("Fresh thought"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
  });

  it("converts selected lines while preserving their text", () => {
    render(composer([checklist], "First\n- Second"));
    act(() => controller.current?.selectAll());
    fireEvent.click(screen.getByRole("button", { name: "editor.format.task-list" }));
    expect(editor.getState().content).toBe("- [ ] First\n- [ ] Second");
  });

  it.each(["- [ ] Task", "- [x] Done", "- Parent\n  - [ ] Nested"])("hides an existing checklist: %s", (content) => {
    render(composer([checklist], content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A note"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
  });

  it("ignores checklist syntax inside code and reacts to manual insertion", () => {
    render(composer([checklist], "```\n- [ ] Example\n```"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown("- [ ] Real task"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("changes visibility only on acceptance, keeps text intact, and remembers the choice", () => {
    render(composer([publicAudience]));
    expect(editor.getState().metadata.visibility).toBe(Visibility.PRIVATE);
    fireEvent.click(screen.getByRole("button", { name: "memo.visibility.public" }));
    expect(editor.getState().metadata.visibility).toBe(Visibility.PUBLIC);
    expect(editor.getState().content).toBe("A note");
    expect(controller.current?.hasFocus()).toBe(true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PRIVATE })));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("hides an already selected audience and reacts to manual changes", () => {
    render(composer([publicAudience]));
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PUBLIC })));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PRIVATE })));
    expect(screen.getByRole("button", { name: "memo.visibility.public" })).toBeInTheDocument();
  });

  it("requires actual Space placement to offer Space visibility", () => {
    const result = render(composer([spaceAudience]));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    result.rerender(composer([spaceAudience], "A note", "spaces/team"));
    expect(screen.getByRole("button", { name: "memo.visibility.space" })).toBeInTheDocument();
    result.rerender(composer([spaceAudience]));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    result.rerender(composer([spaceAudience], "A note", "spaces/team"));
    fireEvent.click(screen.getByRole("button", { name: "memo.visibility.space" }));
    expect(editor.getState().metadata.visibility).toBe(Visibility.SPACE);
  });

  it("shares the three-chip limit across kinds after filtering fulfilled suggestions", () => {
    render(composer([...candidates.slice(0, 2), checklist, publicAudience], "#work A note"));
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "common.add #release" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "memo.visibility.public" })).toBeInTheDocument();
  });

  it("hides all kinds in an empty draft and prevents acceptance while saving", () => {
    render(composer([checklist, publicAudience], ""));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A note"));
    act(() => editor.dispatch(editor.actions.setLoading("saving", true)));
    for (const chip of screen.getAllByRole("button")) {
      expect(chip).toBeDisabled();
      fireEvent.click(chip);
    }
    expect(editor.getState().content).toBe("A note");
    expect(editor.getState().metadata.visibility).toBe(Visibility.PRIVATE);
  });
});

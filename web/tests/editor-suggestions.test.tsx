import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorContent } from "@/components/MemoEditor/edit/components/EditorContent";
import { EditorSuggestions, SuggestionsBar } from "@/components/MemoEditor/edit/components/EditorSuggestions";
import { useTagSuggestions } from "@/components/MemoEditor/edit/hooks/useTagSuggestions";
import { createInitialState, EditorProvider, useEditorContext } from "@/components/MemoEditor/edit/state";
import type { EditorController } from "@/components/MemoEditor/edit/types/editorController";
import { aiServiceClient } from "@/connect";
import { getMemoSuggestions, type MemoSuggestion } from "@/lib/memo-suggestions";
import { type SuggestTagsResponse, SuggestTagsResponseSchema } from "@/types/proto/api/ai_service_pb";
import { Visibility } from "@/types/proto/api/memo_service_pb";

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, values?: { visibility: string }) => (values ? `Set to ${values.visibility}` : key),
}));
vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: { work: 5, release: 2 } }),
  useUsersByUsernames: () => ({ data: undefined }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: undefined }) }));

/** A caret at `offset` in block `block`. */
const caret = (block: number, offset: number) => ({ anchor: { block, offset }, focus: { block, offset } });

let editor: ReturnType<typeof useEditorContext>;
let requestTags: ReturnType<typeof useTagSuggestions>;
let controller: React.RefObject<EditorController | null>;
const candidates = getMemoSuggestions(["work", "release", "planning", "later"].map((value) => ({ factor: "tagSearch", value })));

function Harness({ suggestions, space }: { suggestions: MemoSuggestion[]; space?: string }) {
  editor = useEditorContext();
  requestTags = useTagSuggestions();
  controller = useRef<EditorController>(null);
  return (
    <>
      <EditorContent ref={controller} sourceMode={{ isSourceMode: false, onToggle: vi.fn() }} onSubmit={vi.fn()} onFiles={vi.fn()} />
      <EditorSuggestions onRetry={requestTags} suggestions={suggestions} controllerRef={controller} space={space} />
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
  it.each(["", " \n\t "])("shows suggestions only after writing content, and hides them when cleared: %j", async (content) => {
    render(composer(candidates, content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A thought"));
    expect(screen.getByRole("group", { name: "editor.suggestions" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown(content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("uses a payload-agnostic bar of quiet pills", async () => {
    const onAccept = vi.fn();
    render(<SuggestionsBar suggestions={[{ id: "future:example", label: "Example" }]} disabled={false} onAccept={onAccept} />);
    const chip = screen.getByRole("button", { name: "Example" });
    expect(chip).toHaveClass("border-dashed");
    expect(chip.querySelector("svg")).toBeNull();
    fireEvent.click(chip);
    expect(onAccept).toHaveBeenCalledWith("future:example");
  });

  it("shows at most three and fills the vacated slot after acceptance", async () => {
    render(composer());
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "common.add #later" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.add #work" }));
    await waitFor(() => expect(editor.getState().content).toBe("#work A note"));
    expect(screen.queryByRole("button", { name: "common.add #work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add #later" })).toBeInTheDocument();
    expect(controller.current?.hasFocus()).toBe(true);
  });

  it("inserts at the remembered caret when a chip takes focus", async () => {
    render(composer(candidates, "Before after"));
    act(() => controller.current?.setSelection(caret(0, 7)));
    const chip = screen.getByRole("button", { name: "common.add #work" });
    act(() => chip.focus());
    fireEvent.click(chip);
    await waitFor(() => expect(editor.getState().content).toBe("Before #work after"));
    expect(controller.current?.getSelection()?.focus.offset).toBe(13);
    expect(controller.current?.hasFocus()).toBe(true);
  });

  it("hides tags in restored and manually edited content, but not inside code", async () => {
    render(composer(candidates, "#work\n\n`#release`"));
    expect(screen.queryByRole("button", { name: "common.add #work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.add #release" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown("#work #release"));
    expect(screen.queryByRole("button", { name: "common.add #release" })).not.toBeInTheDocument();
  });

  it("retains acceptance across removal and context changes, then clears it for a fresh draft", async () => {
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

  it("leaves accepted text intact when context changes and prevents insertion during save", async () => {
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

  it("hides the whole row when nothing applies", async () => {
    render(composer([], "A note"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

const checklist: MemoSuggestion = { id: "checklist", kind: "checklist", source: "view" };
const publicAudience: MemoSuggestion = { id: "visibility:PUBLIC", kind: "visibility", visibility: Visibility.PUBLIC, source: "view" };
const spaceAudience: MemoSuggestion = { id: "visibility:SPACE", kind: "visibility", visibility: Visibility.SPACE, source: "view" };

describe("checklist and visibility acceptance", () => {
  it("formats the remembered cursor block and retains acceptance after removal", async () => {
    render(composer([checklist], "First\n\nSecond"));
    act(() => controller.current?.setSelection(caret(1, 1)));
    const chip = screen.getByRole("button", { name: "editor.format.task-list" });
    act(() => chip.focus());
    fireEvent.click(chip);
    await waitFor(() => expect(editor.getState().content).toBe("First\n\n- [ ] Second"));
    expect(controller.current?.hasFocus()).toBe(true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("First\n\nSecond"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.reset()));
    act(() => controller.current?.setMarkdown("Fresh thought"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
  });

  it("converts selected lines while preserving their text", async () => {
    render(composer([checklist], "First\n- Second"));
    act(() => controller.current?.selectAll());
    fireEvent.click(screen.getByRole("button", { name: "editor.format.task-list" }));
    await waitFor(() => expect(editor.getState().content).toBe("- [ ] First\n- [ ] Second"));
  });

  it.each(["- [ ] Task", "- [x] Done", "- Parent\n  - [ ] Nested"])("hides an existing checklist: %s", async (content) => {
    render(composer([checklist], content));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A note"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
  });

  it("ignores checklist syntax inside code and reacts to manual insertion", async () => {
    render(composer([checklist], "```\n- [ ] Example\n```"));
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
    act(() => controller.current?.setMarkdown("- [ ] Real task"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("changes visibility only on acceptance, keeps text intact, and remembers the choice", async () => {
    render(composer([publicAudience]));
    expect(editor.getState().metadata.visibility).toBe(Visibility.PRIVATE);
    fireEvent.click(screen.getByRole("button", { name: "Set to memo.visibility.public" }));
    expect(editor.getState().metadata.visibility).toBe(Visibility.PUBLIC);
    await waitFor(() => expect(editor.getState().content).toBe("A note"));
    expect(controller.current?.hasFocus()).toBe(true);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PRIVATE })));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("hides an already selected audience and reacts to manual changes", async () => {
    render(composer([publicAudience]));
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PUBLIC })));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => editor.dispatch(editor.actions.setMetadata({ visibility: Visibility.PRIVATE })));
    expect(screen.getByRole("button", { name: "Set to memo.visibility.public" })).toBeInTheDocument();
  });

  it("requires actual Space placement to offer Space visibility", async () => {
    const result = render(composer([spaceAudience]));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    result.rerender(composer([spaceAudience], "A note", "spaces/team"));
    expect(screen.getByRole("button", { name: "Set to memo.visibility.space" })).toBeInTheDocument();
    result.rerender(composer([spaceAudience]));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    result.rerender(composer([spaceAudience], "A note", "spaces/team"));
    fireEvent.click(screen.getByRole("button", { name: "Set to memo.visibility.space" }));
    expect(editor.getState().metadata.visibility).toBe(Visibility.SPACE);
  });

  it("shares the three-chip limit across kinds after filtering fulfilled suggestions", async () => {
    render(composer([...candidates.slice(0, 2), checklist, publicAudience], "#work A note"));
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "common.add #release" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set to memo.visibility.public" })).toBeInTheDocument();
  });

  it("hides all kinds in an empty draft and prevents acceptance while saving", async () => {
    render(composer([checklist, publicAudience], ""));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    act(() => controller.current?.setMarkdown("A note"));
    act(() => editor.dispatch(editor.actions.setLoading("saving", true)));
    for (const chip of screen.getAllByRole("button")) {
      expect(chip).toBeDisabled();
      fireEvent.click(chip);
    }
    await waitFor(() => expect(editor.getState().content).toBe("A note"));
    expect(editor.getState().metadata.visibility).toBe(Visibility.PRIVATE);
  });
});

describe("requested tag suggestions", () => {
  it("requests candidates explicitly, merges duplicate tags, and adds them after the pills already shown", async () => {
    const rpc = vi
      .spyOn(aiServiceClient, "suggestTags")
      .mockResolvedValue(create(SuggestTagsResponseSchema, { tags: ["release", "work"] }));
    render(composer([candidates[0], checklist, publicAudience]));
    expect(rpc).not.toHaveBeenCalled();
    await act(() => requestTags("A note"));
    expect(screen.getByRole("status")).toHaveTextContent("editor.tag-suggestions-label (2)");
    expect(rpc).toHaveBeenCalledWith({ content: "A note", candidateTags: ["work", "release"] }, { signal: expect.anything() });
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "#work",
      "editor.format.task-list",
      "Set to memo.visibility.public",
      "#release",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "common.add #release" }));
    fireEvent.click(screen.getByRole("button", { name: "common.add #work" }));
    await waitFor(() => expect(editor.getState().content).toContain("#release #work"));
    expect(screen.getByRole("button", { name: "Set to memo.visibility.public" })).toBeVisible();
  });

  it("retries with the current draft and displays a new tag with only its hashtag", async () => {
    const rpc = vi
      .spyOn(aiServiceClient, "suggestTags")
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValue(create(SuggestTagsResponseSchema, { tags: ["design"] }));
    render(composer([]));
    await act(() => requestTags("A note"));
    expect(screen.getByRole("status")).toHaveTextContent("editor.tag-suggestions-error");
    act(() => controller.current?.setMarkdown("A revised note"));
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(await screen.findByRole("button", { name: "common.add #design" })).toHaveTextContent(/^#design$/);
    expect(rpc.mock.lastCall?.[0].content).toBe("A revised note");
  });

  it("aborts a pending request on reset and ignores a late response in a new draft", async () => {
    const response = Promise.withResolvers<SuggestTagsResponse>();
    const rpc = vi.spyOn(aiServiceClient, "suggestTags").mockReturnValue(response.promise);
    render(composer([]));
    let pending: Promise<void>;
    act(() => {
      pending = requestTags("A note");
    });
    expect(screen.getByRole("status")).toHaveTextContent("editor.blocks.loading");
    act(() => editor.dispatch(editor.actions.reset()));
    expect(rpc.mock.lastCall?.[1]?.signal?.aborted).toBe(true);
    act(() => controller.current?.setMarkdown("Another draft"));
    response.resolve(create(SuggestTagsResponseSchema, { tags: ["old"] }));
    await act(() => pending);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("shows the empty result alongside existing suggestions", async () => {
    vi.spyOn(aiServiceClient, "suggestTags").mockResolvedValue(create(SuggestTagsResponseSchema));
    render(composer([checklist]));
    await act(() => requestTags("A note"));
    expect(screen.getByRole("status")).toHaveTextContent("editor.no-suggested-tags");
    expect(screen.getByRole("button", { name: "editor.format.task-list" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "common.retry" })).not.toBeInTheDocument();
    // The answer stays while the draft changes, so the row keeps its height, and offers to ask again.
    act(() => controller.current?.setMarkdown("A longer note"));
    expect(screen.getByRole("status")).toHaveTextContent("editor.no-suggested-tags");
    expect(screen.getByRole("button", { name: "common.retry" })).toBeVisible();
  });

  it("explains a spent budget without offering a retry", async () => {
    vi.spyOn(aiServiceClient, "suggestTags").mockRejectedValue(new ConnectError("limit", Code.ResourceExhausted));
    render(composer([]));
    await act(() => requestTags("A note"));
    expect(screen.getByRole("status")).toHaveTextContent("editor.tag-suggestions-limit");
    expect(screen.queryByRole("button", { name: "common.retry" })).not.toBeInTheDocument();
  });
});

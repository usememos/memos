import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import MemoView from "@/components/MemoView/MemoView";
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsContext";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const editorCallbacks = vi.hoisted(() => ({ confirm: undefined as MemoEditorProps["onConfirm"] }));

vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: undefined }) }));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({ useResolvedUser: () => undefined }));
vi.mock("@/hooks/useMemoQueries", () => ({ useUpdateMemo: () => ({ mutate: vi.fn() }) }));
vi.mock("@/components/MemoView/components", () => ({
  MemoHeader: () => null,
  MemoBody: () => null,
  MemoCommentListView: () => null,
}));
vi.mock("@/components/MemoEditor/loader", () => ({
  loadMemoEditor: async () => ({
    default: ({ onCancel, onConfirm }: MemoEditorProps) => {
      editorCallbacks.confirm = onConfirm;
      return (
        <textarea
          aria-label="Edit memo"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel?.();
            if (event.key === "Enter" && event.ctrlKey) onConfirm?.("memos/selected");
          }}
        />
      );
    },
  }),
}));

const renderCards = () =>
  render(
    <MemoryRouter>
      <KeyboardShortcutsProvider>
        <MemoView memo={create(MemoSchema, { name: "memos/first", creator: "users/test" })} />
        <MemoView memo={create(MemoSchema, { name: "memos/selected", creator: "users/test" })} />
      </KeyboardShortcutsProvider>
    </MemoryRouter>,
  );

describe("MemoView editor focus", () => {
  it("restores the selected card and its edit shortcut after cancel", async () => {
    renderCards();
    const selected = screen.getAllByRole("article")[1];
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "e" });
    const editor = await screen.findByRole("textbox", { name: "Edit memo" });
    expect(editor).toHaveFocus();

    fireEvent.keyDown(editor, { key: "Escape" });

    const replacement = screen.getAllByRole("article")[1];
    expect(replacement).toHaveFocus();
    fireEvent.keyDown(replacement, { key: "e" });
    expect(await screen.findByRole("textbox", { name: "Edit memo" })).toHaveFocus();
  });

  it("preserves focus moved to another card before save completes", async () => {
    renderCards();
    const [first, selected] = screen.getAllByRole("article");
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "e" });
    await screen.findByRole("textbox", { name: "Edit memo" });

    act(() => first.focus());
    act(() => editorCallbacks.confirm?.("memos/selected"));

    expect(first).toHaveFocus();
  });
});

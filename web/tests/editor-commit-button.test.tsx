import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState, EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import { EditorToolbar } from "@/components/MemoEditor/Toolbar/EditorToolbar";

vi.mock("@/components/MemoEditor/Toolbar/InsertMenu", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/Toolbar/AudienceMenu", () => ({ default: () => null }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

let dispatchSaving: ((saving: boolean) => void) | undefined;

const Toolbar = () => {
  const { actions, dispatch } = useEditorContext();
  dispatchSaving = (saving) => dispatch(actions.setLoading("saving", saving));
  return <EditorToolbar onSave={vi.fn()} onAudioRecorderClick={vi.fn()} onInsertImages={vi.fn()} />;
};

const renderToolbar = (content: string) => {
  const initial = createInitialState();
  initial.content = content;
  render(
    <EditorProvider initialEditorState={initial}>
      <Toolbar />
    </EditorProvider>,
  );
};

describe("EditorToolbar commit button", () => {
  it("names only the verb and moves the shortcut into its tooltip", async () => {
    renderToolbar("A thought");
    const button = screen.getByRole("button", { name: "editor.save" });

    expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+Enter Control+Enter");
    expect(button.querySelector("kbd")).toBeNull();

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => button.focus());
    const tooltip = await waitFor(
      () => {
        const popup = document.querySelector('[data-slot="tooltip-content"]');
        expect(popup).not.toBeNull();
        return popup!;
      },
      { timeout: 2000 },
    );
    expect(tooltip).toHaveTextContent("editor.save");
    expect(tooltip.querySelector("kbd")).not.toBeNull();
  });

  it("keeps the same button mounted while saving", () => {
    renderToolbar("A thought");
    const button = screen.getByRole("button", { name: "editor.save" });

    act(() => dispatchSaving?.(true));

    expect(screen.getByRole("button")).toBe(button);
    expect(button).toBeDisabled();
  });
});

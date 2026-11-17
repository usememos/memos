import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState, EditorProvider, type EditorState, useEditorContext } from "@/components/MemoEditor/edit/state";
import { EditorToolbar } from "@/components/MemoEditor/edit/Toolbar/EditorToolbar";

vi.mock("@/components/MemoEditor/edit/Toolbar/InsertMenu", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/edit/Toolbar/AudienceMenu", () => ({ default: () => null }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

let dispatchSaving: ((saving: boolean) => void) | undefined;
let dispatchContent: ((content: string) => void) | undefined;
let dispatchDrawingError: ((error: EditorState["drawingSaveError"]) => void) | undefined;
const onSave = vi.fn();

const Toolbar = ({ memoName, parentMemoName }: { memoName?: string; parentMemoName?: string }) => {
  const { actions, dispatch } = useEditorContext();
  dispatchSaving = (saving) => dispatch(actions.setLoading("saving", saving));
  dispatchContent = (content) => dispatch(actions.updateContent(content));
  dispatchDrawingError = (error) => dispatch(actions.setDrawingSaveError(error));
  return (
    <EditorToolbar
      onSave={onSave}
      memoName={memoName}
      parentMemoName={parentMemoName}
      onAudioRecorderClick={vi.fn()}
      sourceMode={{ isSourceMode: false, onToggle: vi.fn() }}
      onInsertImages={vi.fn()}
    />
  );
};

const renderToolbar = (content: string, props: { memoName?: string; parentMemoName?: string } = {}) => {
  const initial = createInitialState();
  initial.content = content;
  render(
    <EditorProvider initialEditorState={initial}>
      <Toolbar {...props} />
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
        const popup = document.querySelector(".mu-tooltip-popup");
        expect(popup).not.toBeNull();
        return popup!;
      },
      { timeout: 2000 },
    );
    expect(tooltip).toHaveTextContent("editor.save");
    expect(tooltip.querySelector(".mu-tooltip-shortcut")).toHaveTextContent("Enter");
  });

  it("keeps the same button and label while saving, with the spinner before the label", async () => {
    renderToolbar("A thought");
    const button = screen.getByRole("button", { name: "editor.save" });
    const label = button.querySelector(".mu-button-label");
    expect(button.firstElementChild).toBe(label);

    act(() => dispatchSaving?.(true));

    expect(screen.getByRole("button", { name: "editor.save" })).toBe(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("editor.saving");
    await waitFor(() => expect(button.firstElementChild).toHaveClass("mu-spinner"));
    expect(button.querySelector(".mu-button-label")).toBe(label);
    expect(label).toHaveTextContent("editor.save");

    act(() => dispatchSaving?.(false));

    expect(screen.getByRole("button", { name: "editor.save" })).toBe(button);
    expect(button.firstElementChild).toBe(label);
    expect(button.querySelector(".mu-spinner")).toBeNull();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("keeps the button, label and keyboard focus when validation changes", () => {
    renderToolbar("");
    const button = screen.getByRole("button", { name: "editor.save" });
    const label = button.querySelector(".mu-button-label");
    expect(button.firstElementChild).toBe(label);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("editor.validation.content-required");
    act(() => button.focus());
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();

    act(() => dispatchContent?.("A thought"));
    expect(screen.getByRole("button", { name: "editor.save" })).toBe(button);
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector(".mu-button-label")).toBe(label);
    expect(button.firstElementChild).toBe(label);
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledOnce();

    act(() => dispatchContent?.(""));
    expect(screen.getByRole("button", { name: "editor.save" })).toBe(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.firstElementChild).toBe(label);
    expect(button).toHaveFocus();
  });

  it.each([
    { props: {}, label: "editor.save", description: "editor.saving" },
    { props: { memoName: "memos/existing" }, label: "common.update", description: "editor.updating" },
    { props: { parentMemoName: "memos/parent" }, label: "editor.comment", description: "editor.commenting" },
  ])("keeps $label as the name while describing the pending action", ({ props, label, description }) => {
    renderToolbar("A thought", props);
    const button = screen.getByRole("button", { name: label });
    act(() => dispatchSaving?.(true));
    expect(button).toHaveAccessibleName(label);
    expect(button).toHaveAccessibleDescription(description);
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("uses the leading slot for drawing failures without replacing the button or label", async () => {
    renderToolbar("A thought");
    const button = screen.getByRole("button", { name: "editor.save" });
    const label = button.querySelector(".mu-button-label");
    act(() => button.focus());
    act(() => dispatchDrawingError?.("editor.drawing.saved-needs-update"));
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(button.querySelector(".mu-button-label")).toBe(label);
    act(() => dispatchSaving?.(true));
    await waitFor(() => expect(button.firstElementChild).toHaveClass("mu-spinner"));
    act(() => dispatchSaving?.(false));
    expect(screen.getByRole("button", { name: "editor.save" })).toBe(button);
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(button.querySelector(".mu-button-label")).toBe(label);
    expect(button).toHaveFocus();
  });
});

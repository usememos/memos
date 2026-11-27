import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultVisibilityFor } from "@/components/MemoEditor/edit/initialState";
import { createInitialState, EditorProvider, useEditorSelector } from "@/components/MemoEditor/edit/state";
import { EditorToolbar } from "@/components/MemoEditor/edit/Toolbar/EditorToolbar";
import type { AudienceMenuProps } from "@/components/MemoEditor/edit/types";
import { Visibility } from "@/types/proto/api/memo_service_pb";

vi.mock("@/components/MemoEditor/edit/Toolbar/InsertMenu", () => ({ default: () => null }));
vi.mock("@/components/MemoEditor/edit/Toolbar/AudienceMenu", () => ({
  default: ({ onSpaceChange }: AudienceMenuProps) => (
    <>
      <button type="button" onClick={() => onSpaceChange?.("spaces/work")}>
        place
      </button>
      <button type="button" onClick={() => onSpaceChange?.(undefined)}>
        unplace
      </button>
    </>
  ),
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("the audience a new memo starts with", () => {
  it("takes the author's default outside a Space", () => {
    expect(defaultVisibilityFor({ userDefault: Visibility.PROTECTED })).toBe(Visibility.PROTECTED);
    expect(defaultVisibilityFor({})).toBeUndefined();
  });

  it("is the Space's members for a memo composed into a Space, whatever the author's default", () => {
    expect(defaultVisibilityFor({ userDefault: Visibility.PRIVATE, space: "spaces/work" })).toBe(Visibility.SPACE);
    expect(defaultVisibilityFor({ userDefault: Visibility.PUBLIC, space: "spaces/work" })).toBe(Visibility.SPACE);
  });

  it.each([Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC])("is the parent's audience %s for a comment", (visibility) => {
    expect(defaultVisibilityFor({ userDefault: Visibility.PRIVATE, parent: { visibility } })).toBe(visibility);
    // The Space a comment is written from does not decide its audience; its parent does.
    expect(defaultVisibilityFor({ userDefault: Visibility.PRIVATE, space: "spaces/work", parent: { visibility } })).toBe(visibility);
  });

  it("shares a comment with the parent's Space only when the commenter is given that Space", () => {
    const userDefault = Visibility.PROTECTED;
    expect(defaultVisibilityFor({ userDefault, parent: { visibility: Visibility.SPACE, space: "spaces/work" } })).toBe(Visibility.SPACE);
    expect(defaultVisibilityFor({ userDefault, parent: { visibility: Visibility.SPACE } })).toBe(userDefault);
  });

  it("falls back to the author's default when the parent's audience is unknown", () => {
    expect(defaultVisibilityFor({ userDefault: Visibility.PROTECTED, parent: { visibility: Visibility.VISIBILITY_UNSPECIFIED } })).toBe(
      Visibility.PROTECTED,
    );
  });
});

const Audience = () => {
  const visibility = useEditorSelector((state) => state.metadata.visibility);
  const space = useEditorSelector((state) => state.metadata.space);
  return <output data-testid="audience">{`${Visibility[visibility]} ${space ?? "unplaced"}`}</output>;
};

const renderToolbar = (visibility: Visibility, props: { memoName?: string; defaultVisibility?: Visibility; space?: string } = {}) => {
  const initial = createInitialState();
  initial.metadata = { ...initial.metadata, visibility, space: props.space };
  render(
    <EditorProvider initialEditorState={initial}>
      <EditorToolbar
        onSave={vi.fn()}
        memoName={props.memoName}
        canChooseSpace
        defaultVisibility={props.defaultVisibility}
        onAudioRecorderClick={vi.fn()}
        sourceMode={{ isSourceMode: false, onToggle: vi.fn() }}
        onInsertImages={vi.fn()}
      />
      <Audience />
    </EditorProvider>,
  );
};

describe("choosing a Space in the composer", () => {
  it("shares a new memo with the Space, and returns it to the author's default on leaving", () => {
    renderToolbar(Visibility.PROTECTED, { defaultVisibility: Visibility.PROTECTED });
    fireEvent.click(screen.getByRole("button", { name: "place" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("SPACE spaces/work");
    fireEvent.click(screen.getByRole("button", { name: "unplace" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("PROTECTED unplaced");
  });

  it("keeps an audience the author already changed", () => {
    renderToolbar(Visibility.PUBLIC, { defaultVisibility: Visibility.PRIVATE });
    fireEvent.click(screen.getByRole("button", { name: "place" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("PUBLIC spaces/work");
    fireEvent.click(screen.getByRole("button", { name: "unplace" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("PUBLIC unplaced");
  });

  it("moves an existing memo without widening its audience", () => {
    renderToolbar(Visibility.PRIVATE, { memoName: "memos/1", defaultVisibility: Visibility.PROTECTED });
    fireEvent.click(screen.getByRole("button", { name: "place" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("PRIVATE spaces/work");
  });

  it("narrows an existing memo's Space audience to its author when it leaves the Space", () => {
    renderToolbar(Visibility.SPACE, { memoName: "memos/1", defaultVisibility: Visibility.PUBLIC, space: "spaces/work" });
    fireEvent.click(screen.getByRole("button", { name: "unplace" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("PRIVATE unplaced");
  });
});

// T5 — server-side draft-memo feature: EditorToolbar save-as-draft affordances
// (RED today).
//
// Locked UI (user decision, SUPERSEDES the contract/plan split-button text):
//  - The existing primary Save button (right cluster) is UNCHANGED.
//  - A SEPARATE adjacent ▾ button (its own variant="outline" size="icon"
//    button, NOT a segmented split of Save) opens a DropdownMenu (reusing
//    @/components/ui/dropdown-menu) whose single item is "Save as draft",
//    wired to a new optional `onSaveDraft?: () => void` prop.
//  - A SEPARATE "load previous drafts" icon button in the LEFT cluster,
//    immediately next to the existing `+` InsertMenu, wired to a new optional
//    handler prop.
//  - The ▾ and load-drafts affordances are ABSENT when their handler props
//    are undefined.
//
// Render pattern mirrors tests/about-page.test.tsx (@testing-library/react)
// and the child-mocking pattern of tests/paged-memo-list.test.tsx. The heavy
// InsertMenu / VisibilitySelector children and i18n are mocked so the toolbar
// renders in isolation; EditorProvider supplies the required context.
//
// Expected status TODAY: every test FAILS because EditorToolbar renders no ▾
// trigger, no "Save as draft" item, and no "load previous drafts" button, and
// EditorToolbarProps has no `onSaveDraft` prop.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => {
    const table: Record<string, string> = {
      "common.cancel": "Cancel",
      "editor.save": "Save",
      "editor.saving": "Saving",
      "editor.save-as-draft": "Save as draft",
      "editor.load-drafts": "Load previous drafts",
    };
    return table[key] ?? key;
  },
}));

vi.mock("@/components/MemoEditor/Toolbar/InsertMenu", () => ({
  default: () => <div data-testid="insert-menu" />,
}));

vi.mock("@/components/MemoEditor/Toolbar/VisibilitySelector", () => ({
  default: () => <div data-testid="visibility-selector" />,
}));

import { EditorToolbar } from "@/components/MemoEditor/components/EditorToolbar";
import { EditorProvider } from "@/components/MemoEditor/state";
import type { EditorToolbarProps } from "@/components/MemoEditor/types";

function renderToolbar(props: Partial<EditorToolbarProps> & Record<string, unknown> = {}) {
  const onSave = vi.fn();
  const onAudioRecorderClick = vi.fn();
  render(
    <EditorProvider>
      <EditorToolbar
        onSave={onSave}
        onAudioRecorderClick={onAudioRecorderClick}
        {...(props as EditorToolbarProps)}
      />
    </EditorProvider>,
  );
  return { onSave };
}

describe("<EditorToolbar> save-as-draft affordances (T5, RED today)", () => {
  it("always renders the unchanged primary Save button", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders a separate ▾ trigger and a separate 'load previous drafts' button when handlers are provided", () => {
    renderToolbar({ onSaveDraft: vi.fn(), onLoadDrafts: vi.fn() });

    // The ▾ caret is its OWN trigger button, distinct from the Save button.
    const saveDraftTrigger = screen.getByRole("button", { name: /save as draft|draft options/i });
    expect(saveDraftTrigger).toBeInTheDocument();
    expect(saveDraftTrigger).not.toBe(screen.getByRole("button", { name: "Save" }));

    // The "load previous drafts" button is a separate left-cluster affordance.
    expect(screen.getByRole("button", { name: /load previous drafts/i })).toBeInTheDocument();
  });

  it("omits the ▾ trigger and the load-drafts button when their handler props are undefined", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: /save as draft|draft options/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /load previous drafts/i })).toBeNull();
  });

  it("opening the ▾ dropdown and clicking 'Save as draft' calls onSaveDraft exactly once and never onSave", async () => {
    const onSaveDraft = vi.fn();
    const { onSave } = renderToolbar({ onSaveDraft });

    const trigger = screen.getByRole("button", { name: /save as draft|draft options/i });
    fireEvent.pointerDown(trigger, { button: 0 });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /save as draft/i }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

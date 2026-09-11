import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoHeader from "@/components/MemoView/components/MemoHeader";

const state = vi.hoisted(() => ({
  creator: undefined as { username: string; displayName: string; avatarUrl: string } | undefined,
  currentUser: undefined as { name: string } | undefined,
}));

vi.mock("@/components/RelativeTime", () => ({
  default: () => <>time</>,
}));

// The menu owns its trigger's look now (see memo-action-menu.test.tsx); the header only places it.
vi.mock("@/components/MemoActionMenu", () => ({
  default: () => (
    <button type="button" aria-label="memo-actions">
      Memo actions
    </button>
  ),
}));

vi.mock("@/components/MemoReactionListView", () => ({
  // The header supplies the picker's trigger; the mock renders it with the picker's label.
  ReactionSelector: ({ trigger }: { trigger: React.ReactElement<{ "aria-label"?: string }> }) =>
    React.cloneElement(trigger, { "aria-label": "add-reaction" }, "Add reaction"),
}));

vi.mock("@/components/UserAvatar", () => ({
  default: () => <span>avatar</span>,
}));

vi.mock("@/components/MemoView/components/MemoSpaceBadge", () => ({
  default: ({ spaceName }: { spaceName?: string }) => <span data-testid="memo-space">{spaceName}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, render }: { children?: React.ReactNode; render?: React.ReactNode }) => <>{render || children}</>,
  TooltipContent: () => null,
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  useNewMemo: () => ({ newMemoName: undefined }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/components/MemoView/hooks", () => ({
  useMemoActions: () => ({ unpinMemo: vi.fn() }),
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: { name: "memos/123", visibility: 1, pinned: false, space: "spaces/product" },
    creator: state.creator,
    currentUser: state.currentUser,
    parentPage: "/explore?filter=tagSearch%3Awork",
    isArchived: false,
    readonly: false,
    openEditor: vi.fn(),
  }),
  useMemoViewDerived: () => ({
    createTime: new Date("2026-08-26T00:00:00Z"),
    updateTime: undefined,
    displayTime: new Date("2026-08-26T00:00:00Z"),
    isDisplayingUpdatedTime: false,
    relativeTimeFormat: "auto",
  }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}|{JSON.stringify(location.state)}
    </output>
  );
};

describe("MemoHeader navigation", () => {
  beforeEach(() => {
    state.creator = undefined;
    state.currentUser = undefined;
  });

  it("uses one compact interaction surface for memo header actions", () => {
    state.currentUser = { name: "users/alice" };

    render(
      <MemoryRouter>
        <MemoHeader />
      </MemoryRouter>,
    );

    const reaction = screen.getByRole("button", { name: "add-reaction" });
    const actions = screen.getByRole("button", { name: "memo-actions" });
    const actionRail = actions.closest('[data-slot="memo-header-actions"]');

    expect(actionRail).toHaveClass("items-center", "gap-1");
    // The header shows the picker only while the card is engaged or the picker is open, and its
    // trigger is the same 24px quiet square as the other header actions.
    expect(reaction.parentElement).toHaveClass("sm:group-focus-within:flex", "sm:has-[[data-popup-open]]:flex");
    expect(reaction).toHaveClass("size-6", "rounded-md", "text-muted-foreground/70");
    expect(reaction.className).not.toMatch(/border-none|rounded-full|ring-/);
  });

  it.each([false, true])("uses a keyboard-operable timestamp and preserves origin when showCreator=%s", (showCreator) => {
    if (showCreator) {
      state.creator = { username: "alice", displayName: "Alice", avatarUrl: "" };
    }

    render(
      <MemoryRouter initialEntries={["/explore?filter=tagSearch%3Awork"]}>
        <MemoHeader showCreator={showCreator} />
        <LocationProbe />
      </MemoryRouter>,
    );

    const timestamp = screen.getByRole("button", { name: "time" });
    timestamp.focus();
    expect(timestamp).toHaveFocus();

    fireEvent.click(timestamp);
    expect(screen.getByTestId("location")).toHaveTextContent('/memos/123|{"from":"/explore?filter=tagSearch%3Awork"}');
  });

  it.each([false, true])("keeps the Space pill beside the timestamp when showCreator=%s", (showCreator) => {
    if (showCreator) {
      state.creator = { username: "alice", displayName: "Alice", avatarUrl: "" };
    }

    render(
      <MemoryRouter>
        <MemoHeader showCreator={showCreator} showSpace />
      </MemoryRouter>,
    );

    const timestamp = screen.getByRole("button", { name: "time" });
    const space = screen.getByTestId("memo-space");
    const metadata = space.closest('[data-slot="memo-header-meta"]');

    expect(metadata).toContainElement(timestamp);
    expect(space.closest("a, button")).toBeNull();
  });
});

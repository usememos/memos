import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoHeader from "@/components/MemoView/components/MemoHeader";

const state = vi.hoisted(() => ({
  creator: undefined as { username: string; displayName: string; avatarUrl: string } | undefined,
}));

vi.mock("@/components/RelativeTime", () => ({
  default: () => <>time</>,
}));

vi.mock("@/components/MemoActionMenu", () => ({
  default: () => null,
}));

vi.mock("@/components/MemoReactionListView", () => ({
  ReactionSelector: () => null,
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
    currentUser: undefined,
    parentPage: "/explore?filter=tagSearch%3Awork",
    parentScope: "preserve",
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
    expect(screen.getByTestId("location")).toHaveTextContent(
      '/memos/123|{"from":"/explore?filter=tagSearch%3Awork","fromScope":"preserve"}',
    );
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

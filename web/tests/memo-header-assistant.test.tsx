import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MemoHeader from "@/components/MemoView/components/MemoHeader";

const state = vi.hoisted(() => ({
  assistant: undefined as { title: string; icon: string } | undefined,
}));

vi.mock("@/components/RelativeTime", () => ({ default: () => <>time</> }));
vi.mock("@/components/MemoActionMenu", () => ({ default: () => null }));
vi.mock("@/components/MemoReactionListView", () => ({ ReactionSelector: () => null }));
vi.mock("@/components/UserAvatar", () => ({ default: () => <span>avatar</span> }));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, render }: { children?: React.ReactNode; render?: React.ReactNode }) => <>{render || children}</>,
  TooltipContent: () => null,
}));

vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ newMemoName: undefined }) }));
vi.mock("@/i18n", () => ({ default: { language: "en" } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: { name: "memos/123", visibility: 1, pinned: false, assistant: state.assistant },
    creator: { username: "alice", displayName: "Alice", avatarUrl: "" },
    currentUser: undefined,
    parentPage: undefined,
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

describe("MemoHeader assistant attribution", () => {
  it("credits the assistant instead of the author who stores the review", () => {
    // An automatic review is stored under the reviewed memo's own author, so without
    // this the header would present the assistant's words as the author's own.
    state.assistant = { title: "读书助手", icon: "📗" };

    render(
      <MemoryRouter>
        <MemoHeader showCreator />
      </MemoryRouter>,
    );

    const label = screen.getByText("读书助手");
    expect(screen.queryByText("Alice")).toBeNull();
    // There is no profile behind an assistant, so the name must not be a link.
    expect(label.closest("a")).toBeNull();
    expect(screen.getByText("📗")).toBeInTheDocument();
    expect(label.closest('[data-slot="memo-header-meta"]')).not.toBeNull();
  });

  it("keeps crediting the author on an ordinary memo", () => {
    state.assistant = undefined;

    render(
      <MemoryRouter>
        <MemoHeader showCreator />
      </MemoryRouter>,
    );

    expect(screen.getByText("Alice").closest("a")).toHaveAttribute("href", "/u/alice");
  });
});

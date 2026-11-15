import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoHeader from "@/components/MemoView/components/MemoHeader";

const state = vi.hoisted(() => ({
  blurred: true,
  showBlurredContent: true,
  toggleBlurVisibility: vi.fn(),
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

vi.mock("@/contexts/NewMemoContext", () => ({
  useNewMemo: () => ({ newMemoName: undefined }),
}));

vi.mock("@/i18n", () => ({
  default: { language: "en" },
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: { name: "memos/123", visibility: 1, pinned: false },
    creator: undefined,
    currentUser: undefined,
    parentPage: "/",
    isArchived: false,
    readonly: false,
    isEditing: false,
    openEditor: vi.fn(),
    blurred: state.blurred,
    showBlurredContent: state.showBlurredContent,
    toggleBlurVisibility: state.toggleBlurVisibility,
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

const renderHeader = () =>
  render(
    <MemoryRouter>
      <MemoHeader />
    </MemoryRouter>,
  );

describe("MemoHeader re-blur", () => {
  beforeEach(() => {
    state.blurred = true;
    state.showBlurredContent = true;
    state.toggleBlurVisibility.mockClear();
  });

  it("blurs revealed sensitive content again", () => {
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "memo.hide-sensitive-content" }));

    expect(state.toggleBlurVisibility).toHaveBeenCalledOnce();
  });

  it("stays hidden while the content is still blurred", () => {
    state.showBlurredContent = false;
    renderHeader();

    expect(screen.queryByRole("button", { name: "memo.hide-sensitive-content" })).toBeNull();
  });

  it("stays hidden on memos without a blurring tag", () => {
    state.blurred = false;
    renderHeader();

    expect(screen.queryByRole("button", { name: "memo.hide-sensitive-content" })).toBeNull();
  });
});

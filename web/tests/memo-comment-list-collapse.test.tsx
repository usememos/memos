import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoCommentListView from "@/components/MemoView/components/MemoCommentListView";

const state = vi.hoisted(() => ({
  includeComments: false,
  memo: { name: "memos/top", parent: undefined as string | undefined },
  commentAmount: 2,
  useMemoComments: vi.fn(),
}));

vi.mock("@/hooks/useDevicePreferences", () => ({ useDevicePreferences: () => ({ includeComments: state.includeComments }) }));
vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({ memo: state.memo, parentPage: "/" }),
  useMemoViewDerived: () => ({ isInMemoDetailPage: false, commentAmount: state.commentAmount }),
}));
vi.mock("@/hooks/useMemoQueries", () => ({
  useMemoComments: (name: string, options: { enabled: boolean }) => {
    state.useMemoComments(name, options);
    return {
      data: options.enabled
        ? { memos: [{ name: "memos/c1", creator: "users/a", snippet: "First comment", content: "First comment", attachments: [] }] }
        : undefined,
    };
  },
}));
vi.mock("@/hooks/useNearViewport", () => ({ useNearViewport: () => ({ ref: { current: null }, isNearViewport: true }) }));
vi.mock("@/hooks/useUserQueries", () => ({ useUsersByNames: () => ({ data: new Map() }) }));
vi.mock("@/components/MemoPreview", () => ({ MemoPreview: ({ content }: { content: string }) => <span>{content}</span> }));
vi.mock("@/components/UserAvatar", () => ({ default: () => null }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, options?: { count: number }) => (options ? `${key}:${options.count}` : key),
}));

const renderStrip = () =>
  render(
    <MemoryRouter>
      <MemoCommentListView />
    </MemoryRouter>,
  );

describe("<MemoCommentListView>", () => {
  beforeEach(() => {
    state.includeComments = false;
    state.memo = { name: "memos/top", parent: undefined };
    state.commentAmount = 2;
    state.useMemoComments.mockReset();
  });

  it("previews a memo's comments while lists leave comments out", () => {
    renderStrip();

    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.queryByText(/view-all-count/)).not.toBeInTheDocument();
    expect(state.useMemoComments).toHaveBeenCalledWith("memos/top", expect.objectContaining({ enabled: true }));
  });

  it("keeps only the link to the thread while lists include the comments themselves", () => {
    state.includeComments = true;
    renderStrip();

    const link = screen.getByRole("link", { name: "memo.comment.view-all-count:2" });
    expect(link).toHaveAttribute("href", "/memos/top#memo-comments");
    expect(screen.queryByText("First comment")).not.toBeInTheDocument();
    expect(state.useMemoComments).toHaveBeenCalledWith("memos/top", expect.objectContaining({ enabled: false }));
  });

  it("still previews a comment's replies, which show under a thread and not in a list", () => {
    state.includeComments = true;
    state.memo = { name: "memos/comment", parent: "memos/top" };
    renderStrip();

    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(state.useMemoComments).toHaveBeenCalledWith("memos/comment", expect.objectContaining({ enabled: true }));
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoBody from "@/components/MemoView/components/MemoBody";

const mockState = vi.hoisted(() => ({
  memo: {
    name: "memos/1",
    content: "",
    relations: [],
    attachments: [],
    reactions: [],
  },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  useResolvedMentionUsernames: () => new Set<string>(),
}));

vi.mock("@/components/MemoContent/MemoMarkdownRenderer", () => ({
  MemoMarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/MemoMetadata", () => ({
  AttachmentListView: () => null,
  LocationDisplayView: () => null,
  RelationListView: () => null,
}));

vi.mock("@/components/MemoReactionListView", () => ({
  MemoReactionListView: () => null,
}));

vi.mock("@/components/MemoView/hooks", () => ({
  useMemoHandlers: () => ({
    handleMemoContentClick: vi.fn(),
    handleMemoContentDoubleClick: vi.fn(),
  }),
}));

vi.mock("@/components/MemoView/MemoViewContext", () => ({
  useMemoViewContext: () => ({
    memo: mockState.memo,
    parentPage: "",
    showBlurredContent: false,
    blurred: false,
    readonly: false,
    openEditor: vi.fn(),
    openPreview: vi.fn(),
    toggleBlurVisibility: vi.fn(),
  }),
}));

const createMemo = (content: string) => ({
  name: "memos/1",
  content,
  relations: [],
  attachments: [],
  reactions: [],
});

describe("<MemoBody /> compact content", () => {
  it("keeps expanded compact content expanded when memo content changes", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      if ((this as HTMLElement).hasAttribute("data-memo-content")) {
        return { x: 0, y: 0, width: 320, height: 1000, top: 0, right: 320, bottom: 1000, left: 0, toJSON: () => ({}) };
      }
      return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}) };
    });

    mockState.memo = createMemo("line 1\nline 2");
    const { rerender } = render(<MemoBody compact={true} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /memo\.show-more/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /memo\.show-more/ }));
    expect(screen.getByRole("button", { name: /memo\.show-less/ })).toBeInTheDocument();

    mockState.memo = createMemo("line 1\nline 2 updated");
    rerender(<MemoBody compact={true} />);

    expect(screen.getByRole("button", { name: /memo\.show-less/ })).toBeInTheDocument();
  });
});

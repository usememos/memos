import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLAMP_PREVIEW_HEIGHT_PX, CLAMP_TRIGGER_HEIGHT_PX } from "@/components/ClampedSection";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<MemoBody /> compact body clamp", () => {
  it("keeps a buffer between the preview height and the fold trigger", () => {
    expect(CLAMP_TRIGGER_HEIGHT_PX).toBeGreaterThan(CLAMP_PREVIEW_HEIGHT_PX);
  });

  it("folds tall compact bodies and keeps them expanded across content changes", async () => {
    // jsdom has no layout; report every element as taller than the fold trigger.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(CLAMP_TRIGGER_HEIGHT_PX + 100);

    mockState.memo = createMemo("line 1\nline 2");
    const { rerender } = render(<MemoBody compact={true} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /memo\.show-more/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /memo\.show-more/ }));
    expect(screen.getByRole("button", { name: /memo\.show-less/ })).toBeInTheDocument();

    mockState.memo = createMemo("line 1\nline 2 updated");
    rerender(<MemoBody compact={true} />);

    expect(screen.getByRole("button", { name: /memo\.show-less/ })).toBeInTheDocument();
  });

  it("renders no clamp when compact is off", () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(CLAMP_TRIGGER_HEIGHT_PX + 100);

    mockState.memo = createMemo("tall content");
    render(<MemoBody compact={false} />);

    expect(screen.queryByRole("button", { name: /memo\.show-more/ })).toBeNull();
  });
});

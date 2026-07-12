import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PagedMemoList from "@/components/PagedMemoList";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const view = vi.hoisted(() => ({ maxColumns: 1 as 0 | 1 | 2 | 3, compactMode: false }));
const feed = vi.hoisted(() => ({ memos: [] as unknown[] }));

vi.mock("@/hooks/useMemoQueries", () => ({
  useInfiniteMemos: () => ({
    data: { pages: [{ memos: feed.memos, nextPageToken: "" }] },
    fetchNextPage: vi.fn(async () => undefined),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: [] }),
}));

vi.mock("@/contexts/ViewContext", () => ({
  useView: () => view,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => (key === "message.no-data" ? "No data found." : key),
}));

vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/MemoFilters", () => ({
  default: () => <div data-testid="memo-filters" />,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: () => <div data-testid="memo-editor" />,
}));

const memo = { name: "memos/1", content: "hello", updateTime: undefined } as unknown as Memo;

const renderList = (
  renderer: (memo: Memo, options: { compact: boolean }) => React.ReactElement = () => <div />,
  options: { showMemoEditor?: boolean } = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PagedMemoList renderer={renderer} showMemoEditor={options.showMemoEditor} />
    </QueryClientProvider>,
  );

describe("<PagedMemoList>", () => {
  beforeEach(() => {
    view.maxColumns = 1;
    view.compactMode = false;
    feed.memos = [];
  });

  it("uses the tile sprite Placeholder for the empty state", () => {
    renderList();

    expect(screen.getByText("No data found.")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-sprite")).toBeInTheDocument();
  });

  it("shows the empty state below the memo editor", () => {
    renderList(undefined, { showMemoEditor: true });

    expect(screen.getByTestId("memo-editor")).toBeInTheDocument();
    expect(screen.getByText("No data found.")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-sprite")).toBeInTheDocument();
  });

  it("places the empty state in the first grid column", () => {
    view.maxColumns = 0;
    const widthSpy = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1200);
    try {
      renderList(undefined, { showMemoEditor: true });

      const leadingTile = screen.getByText("No data found.").closest(".absolute");
      expect(leadingTile).not.toBeNull();
      expect(leadingTile).toContainElement(screen.getByTestId("memo-editor"));
    } finally {
      widthSpy.mockRestore();
    }
  });

  describe("compact policy", () => {
    beforeEach(() => {
      feed.memos = [memo];
    });

    it("threads compact=false at one column with compact mode off", () => {
      const renderer = vi.fn((m: Memo) => <div key={m.name} />);
      renderList(renderer);
      expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ name: "memos/1" }), { compact: false });
    });

    it("threads compact=true at one column with compact mode on", () => {
      view.compactMode = true;
      const renderer = vi.fn((m: Memo) => <div key={m.name} />);
      renderList(renderer);
      expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ name: "memos/1" }), { compact: true });
    });

    it("respects the compact setting in the narrow-width fallback even when columns are allowed", () => {
      // jsdom measures 0px, so the flow fallback renders and behaves exactly like maxColumns = 1.
      view.maxColumns = 0;
      const renderer = vi.fn((m: Memo) => <div key={m.name} />);
      renderList(renderer);
      expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ name: "memos/1" }), { compact: false });
    });

    it("forces compact once the width fits the grid", () => {
      view.maxColumns = 0;
      const widthSpy = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1200);
      try {
        const renderer = vi.fn((m: Memo) => <div key={m.name} />);
        renderList(renderer);
        expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ name: "memos/1" }), { compact: true });
      } finally {
        widthSpy.mockRestore();
      }
    });
  });
});

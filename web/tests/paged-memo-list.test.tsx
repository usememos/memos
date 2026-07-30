import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PagedMemoList from "@/components/PagedMemoList";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const view = vi.hoisted(() => ({ maxColumns: 1 as 0 | 1 | 2 | 3, compactMode: false }));
const feed = vi.hoisted(() => ({
  memos: [] as unknown[],
  hasNextPage: false,
  isLoading: false,
  fetchNextPage: vi.fn(async () => undefined),
}));
const readiness = vi.hoisted(() => ({ userSettings: true }));

vi.mock("@/hooks/useMemoQueries", () => ({
  useInfiniteMemos: () => ({
    data: { pages: [{ memos: feed.memos, nextPageToken: "" }] },
    fetchNextPage: feed.fetchNextPage,
    hasNextPage: feed.hasNextPage,
    isFetchingNextPage: false,
    isLoading: feed.isLoading,
  }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: [] }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isUserSettingsInitialized: readiness.userSettings }),
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

const memo = { name: "memos/1", content: "hello", updateTime: undefined } as unknown as Memo;

const renderList = (
  renderer: (memo: Memo, options: { compact: boolean }) => React.ReactElement = () => <div />,
  options: { leading?: React.ReactNode } = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PagedMemoList renderer={renderer} renderLeading={options.leading ? () => options.leading : undefined} />
    </QueryClientProvider>,
  );

describe("<PagedMemoList>", () => {
  beforeEach(() => {
    view.maxColumns = 1;
    view.compactMode = false;
    feed.memos = [];
    feed.hasNextPage = false;
    feed.isLoading = false;
    feed.fetchNextPage.mockClear();
    readiness.userSettings = true;
  });

  it("keeps fetched memo content hidden until privacy settings settle", () => {
    feed.memos = [memo];
    readiness.userSettings = false;
    const renderer = vi.fn((m: Memo) => <div key={m.name}>{m.content}</div>);

    renderList(renderer);

    expect(renderer).not.toHaveBeenCalled();
    expect(screen.queryByText("hello")).not.toBeInTheDocument();
  });

  it("renders fetched memo content once privacy settings settle", () => {
    feed.memos = [memo];
    const renderer = vi.fn((m: Memo) => <div key={m.name}>{m.content}</div>);

    renderList(renderer);

    expect(renderer).toHaveBeenCalled();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("does not auto-fetch more pages before privacy settings settle", async () => {
    vi.useFakeTimers();
    try {
      feed.memos = [memo];
      feed.hasNextPage = true;
      readiness.userSettings = false;

      renderList();
      await act(async () => vi.advanceTimersByTimeAsync(1000));

      expect(feed.fetchNextPage).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-fetches more pages once memo data is ready", async () => {
    vi.useFakeTimers();
    try {
      feed.memos = [memo];
      feed.hasNextPage = true;

      renderList();
      await act(async () => vi.advanceTimersByTimeAsync(200));

      expect(feed.fetchNextPage).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("delays the initial loading spinner to avoid flashing on fast loads", async () => {
    vi.useFakeTimers();
    try {
      feed.isLoading = true;
      const { container } = renderList();

      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(249));
      expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps route-owned leading content visible while memos load", () => {
    feed.isLoading = true;

    renderList(undefined, { leading: <div data-testid="leading-content" /> });

    expect(screen.getByTestId("leading-content")).toBeInTheDocument();
  });

  it("uses the tile sprite Placeholder for the empty state", () => {
    renderList();

    expect(screen.getByText("No data found.")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-sprite")).toBeInTheDocument();
  });

  it("shows the empty state below route-owned leading content", () => {
    renderList(undefined, { leading: <div data-testid="leading-content" /> });

    expect(screen.getByTestId("leading-content")).toBeInTheDocument();
    expect(screen.getByText("No data found.")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-sprite")).toBeInTheDocument();
  });

  it("places leading content and the empty state in the first grid column", () => {
    view.maxColumns = 0;
    const widthSpy = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1200);
    try {
      renderList(undefined, { leading: <div data-testid="leading-content" /> });

      const leadingTile = screen.getByText("No data found.").closest(".absolute");
      expect(leadingTile).not.toBeNull();
      expect(leadingTile).toContainElement(screen.getByTestId("leading-content"));
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

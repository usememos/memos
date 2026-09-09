import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PagedMemoList from "@/components/PagedMemoList";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const view = vi.hoisted(() => ({ maxColumns: 1 as 0 | 1 | 2 | 3, compactMode: false }));
const feed = vi.hoisted(() => ({
  memos: [] as unknown[],
  hasNextPage: false,
  isLoading: false,
  fetchNextPage: vi.fn(async () => undefined),
  refetch: vi.fn(),
  error: null as ConnectError | null,
  isFetchNextPageError: false,
}));
const sidebar = vi.hoisted(() => ({ setQuickFindOpen: vi.fn() }));
const filterContext = vi.hoisted(() => ({ removeFilter: vi.fn() }));
const readiness = vi.hoisted(() => ({ userSettings: true }));
const memoQuery = vi.hoisted(() => ({ request: undefined as Record<string, unknown> | undefined }));

vi.mock("@/hooks/useMemoQueries", () => ({
  useInfiniteMemos: (request: Record<string, unknown>) => {
    memoQuery.request = request;
    return {
      data: { pages: [{ memos: feed.memos, nextPageToken: "" }] },
      fetchNextPage: feed.fetchNextPage,
      hasNextPage: feed.hasNextPage,
      isFetchingNextPage: false,
      isLoading: feed.isLoading,
      error: feed.error,
      isError: !!feed.error,
      isFetchNextPageError: feed.isFetchNextPageError,
      refetch: feed.refetch,
      isFetching: false,
    };
  },
}));

vi.mock("@/contexts/MemoFilterContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/contexts/MemoFilterContext")>()),
  useMemoFilterContext: () => ({ filters: [{ factor: "celSearch", value: "pinned" }], removeFilter: filterContext.removeFilter }),
}));

vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => sidebar }));

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
    feed.refetch.mockClear();
    feed.error = null;
    feed.isFetchNextPageError = false;
    sidebar.setQuickFindOpen.mockClear();
    filterContext.removeFilter.mockClear();
    readiness.userSettings = true;
    memoQuery.request = undefined;
  });

  it.each([1, 0] as const)("shows recoverable validation errors in layout %i instead of an empty state", (columns) => {
    view.maxColumns = columns;
    const widthSpy = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1200);
    try {
      feed.error = new ConnectError("unknown identifier <script>bad</script>", Code.InvalidArgument);
      renderList();
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("search.invalid-expression");
      expect(alert).toHaveTextContent("unknown identifier <script>bad</script>");
      expect(alert.querySelector("script")).toBeNull();
      expect(screen.queryByText("No data found.")).not.toBeInTheDocument();
      expect(screen.getByTestId("memo-filters")).toBeInTheDocument();
      if (columns === 0) expect(alert.closest(".absolute")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "search.edit-query" }));
      expect(sidebar.setQuickFindOpen).toHaveBeenCalledWith(true);
      fireEvent.click(screen.getByRole("button", { name: "search.clear-query" }));
      const remove = filterContext.removeFilter.mock.calls[0][0];
      expect(remove({ factor: "celSearch" })).toBe(true);
      expect(remove({ factor: "contentSearch" })).toBe(true);
      expect(remove({ factor: "tagSearch" })).toBe(false);
      expect(screen.queryByRole("button", { name: "search.retry" })).not.toBeInTheDocument();
    } finally {
      widthSpy.mockRestore();
    }
  });

  it.each([Code.PermissionDenied, Code.Unauthenticated])("shows access errors separately (%i)", (code) => {
    feed.error = new ConnectError("denied", code);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent("search.access-error");
    expect(screen.queryByText("search.invalid-expression")).not.toBeInTheDocument();
  });

  it("retries initial network errors", () => {
    feed.error = new ConnectError("offline", Code.Unavailable);
    renderList();
    expect(screen.getByRole("alert")).toHaveTextContent("search.load-error");
    fireEvent.click(screen.getByRole("button", { name: "search.retry" }));
    expect(feed.refetch).toHaveBeenCalledOnce();
    expect(feed.fetchNextPage).not.toHaveBeenCalled();
  });

  it("keeps prior pages but stops automatic pagination after a failed page until Retry", async () => {
    vi.useFakeTimers();
    try {
      feed.memos = [memo];
      feed.hasNextPage = true;
      feed.error = new ConnectError("offline", Code.Unavailable);
      feed.isFetchNextPageError = true;
      renderList((memo) => <div>{memo.content}</div>);
      expect(screen.getByText("hello")).toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(1000));
      fireEvent.scroll(window);
      expect(feed.fetchNextPage).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "search.retry" }));
      expect(feed.fetchNextPage).toHaveBeenCalledOnce();
      expect(feed.refetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

  it("combines the selected Space filter with the memo list filter", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PagedMemoList renderer={() => <div />} contextFilter={'space == "spaces/product"'} filter="pinned == true" />
      </QueryClientProvider>,
    );

    expect(memoQuery.request).toMatchObject({
      filter: '(space == "spaces/product") && (pinned == true)',
    });
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

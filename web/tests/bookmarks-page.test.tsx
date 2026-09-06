import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Bookmarks from "@/pages/Bookmarks";

const state = vi.hoisted(() => ({
  spaceFilter: undefined as string | undefined,
  listProps: [] as Array<Record<string, unknown>>,
  refreshCovers: vi.fn(),
}));

const refreshResponse = (memosExamined: number, updatedLinks: number, failedLinks: number, nextPageToken = "") => ({
  memosExamined,
  updatedLinks,
  failedLinks,
  skippedLinks: 0,
  nextPageToken,
});

vi.mock("@/connect", () => ({
  memoServiceClient: { refreshMemoLinkCovers: state.refreshCovers },
}));

vi.mock("@/components/PagedMemoList", () => ({
  default: (props: Record<string, unknown>) => {
    state.listProps.push(props);
    const renderLeading = props.renderLeading as ((options: { useGrid: boolean }) => React.ReactNode) | undefined;
    return (
      <div>
        {renderLeading?.({ useGrid: false })}
        <div data-testid="list" />
      </div>
    );
  },
}));
vi.mock("@/components/MemoView", () => ({ default: () => <div /> }));
vi.mock("@/components/BookmarksImport/BookmarksImportDialog", () => ({ default: () => <div /> }));
vi.mock("@/hooks", () => ({
  useMemoFilters: () => "creator_filter",
  useMemoSorting: () => ({ listSort: undefined, orderBy: undefined }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/u1" }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ memoFilter: state.spaceFilter }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Bookmarks />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("<Bookmarks>", () => {
  beforeEach(() => {
    state.spaceFilter = undefined;
    state.listProps = [];
    state.refreshCovers.mockReset();
  });

  it("feeds only link memos via the has_link filter", () => {
    renderPage();

    expect(state.listProps[0]?.contextFilter).toBe("(has_link)");
  });

  it("combines has_link with the remembered Space scope", () => {
    state.spaceFilter = 'space == "spaces/s1"';
    renderPage();

    expect(state.listProps[0]?.contextFilter).toBe('(has_link) && (space == "spaces/s1")');
  });

  it("surfaces the cover refresh result after clicking update covers", async () => {
    state.refreshCovers.mockResolvedValue(refreshResponse(5, 2, 1));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));

    const status = await screen.findByText("bookmarks.refresh-covers-result");
    expect(status).toBeInTheDocument();
  });

  it("pages through multiple batches using nextPageToken", async () => {
    state.refreshCovers.mockResolvedValueOnce(refreshResponse(200, 2, 0, "200")).mockResolvedValueOnce(refreshResponse(50, 1, 0, ""));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));

    const status = await screen.findByText("bookmarks.refresh-covers-updated");
    expect(status).toBeInTheDocument();
    expect(state.refreshCovers).toHaveBeenCalledTimes(2);
    expect(state.refreshCovers).toHaveBeenNthCalledWith(
      1,
      { pageToken: "", pageSize: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(state.refreshCovers).toHaveBeenNthCalledWith(
      2,
      { pageToken: "200", pageSize: 20 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("stops the active request when leaving bookmarks", async () => {
    state.refreshCovers.mockReturnValue(new Promise(() => {}));
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));
    const signal = state.refreshCovers.mock.calls[0]?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("allows cancelling refresh without starting the next page", async () => {
    let resolvePage: (value: ReturnType<typeof refreshResponse>) => void = () => undefined;
    state.refreshCovers.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await act(async () => resolvePage(refreshResponse(20, 1, 0, "20")));
    expect(state.refreshCovers).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("bookmarks.refresh-covers-cancelled")).toBeInTheDocument();
  });

  it("invalidates covers saved before a later page fails", async () => {
    state.refreshCovers.mockResolvedValueOnce(refreshResponse(20, 2, 0, "20")).mockRejectedValueOnce(new Error("offline"));
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));
    expect(await screen.findByText("bookmarks.refresh-covers-error")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["memos"] });
    invalidate.mockRestore();
  });

  it("surfaces a cover refresh failure", async () => {
    state.refreshCovers.mockRejectedValue(new Error("boom"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "bookmarks.refresh-covers" }));

    expect(await screen.findByText("bookmarks.refresh-covers-error")).toBeInTheDocument();
  });

  it("threads the card variant through the renderer", () => {
    renderPage();

    const renderer = state.listProps[0]?.renderer as (memo: unknown, options: { variant: string }) => unknown;
    expect(renderer).toBeTypeOf("function");
  });
});

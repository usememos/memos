import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type RaindropRow } from "@/components/BookmarksImport/csv";
import { buildMemoContent, useBookmarkImport } from "@/components/BookmarksImport/useBookmarkImport";

const mocks = vi.hoisted(() => ({
  listMemos: vi.fn(),
  createMemo: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: { listMemos: mocks.listMemos, createMemo: mocks.createMemo },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  };
});

const row = (overrides: Partial<RaindropRow> = {}): RaindropRow => ({
  title: "A title",
  note: "",
  url: "https://example.com/a",
  folder: "Recursos de desarrollo",
  tags: ["dev"],
  highlights: "",
  ...overrides,
});

const renderImportHook = () =>
  renderHook(() => useBookmarkImport(), {
    wrapper: ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>,
  });

describe("buildMemoContent", () => {
  it("slugs the folder, passes tags through, and appends the note", () => {
    expect(buildMemoContent(row({ note: "my note" }))).toBe(
      ["[A title](https://example.com/a)", "#recursos-de-desarrollo #dev", "my note"].join("\n\n"),
    );
  });

  it("drops the unsorted folder tag and falls back to the URL as link text", () => {
    expect(buildMemoContent(row({ title: "", folder: "Unsorted", tags: [] }))).toBe("[https://example.com/a](https://example.com/a)");
  });

  it("appends highlights below the note", () => {
    const content = buildMemoContent(row({ note: "note", highlights: "hl" }));
    expect(content.endsWith("note\n\nhl")).toBe(true);
  });
});

describe("useBookmarkImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listMemos.mockResolvedValue({
      memos: [{ content: "[Existing](https://example.com/existing)" }],
      nextPageToken: "",
    });
  });

  it("skips rows whose URL already exists and creates the rest", async () => {
    mocks.createMemo.mockResolvedValue({});
    const { result } = renderImportHook();

    await act(() =>
      result.current.start([row(), row({ url: "https://example.com/existing", title: "Existing" }), row({ url: "https://example.com/b" })]),
    );
    await waitFor(() => expect(result.current.progress.status).toBe("done"));

    expect(mocks.createMemo).toHaveBeenCalledTimes(2);
    expect(result.current.progress).toMatchObject({ total: 3, created: 2, skipped: 1, failed: 0 });
    expect(mocks.listMemos).toHaveBeenCalledWith(expect.objectContaining({ filter: "has_link" }));
  });

  it("counts per-row failures without aborting the run", async () => {
    mocks.createMemo.mockRejectedValue(new Error("boom"));
    const { result } = renderImportHook();

    await act(() => result.current.start([row(), row({ url: "https://example.com/b" })]));
    await waitFor(() => expect(result.current.progress.status).toBe("done"));

    expect(result.current.progress).toMatchObject({ total: 2, created: 0, failed: 2 });
  });

  it("invalidates the memo caches once at the end", async () => {
    mocks.createMemo.mockResolvedValue({});
    const { result } = renderImportHook();

    await act(() => result.current.start([row()]));
    await waitFor(() => expect(result.current.progress.status).toBe("done"));

    expect(mocks.invalidate).toHaveBeenCalled();
  });

  it("deduplicates against bare URLs, autolinks, and memo property links", async () => {
    mocks.listMemos.mockResolvedValue({
      memos: [
        { content: "check out https://example.com/bare" },
        { content: "check <https://example.com/auto>" },
        { content: "memo without link in text", property: { links: [{ url: "https://example.com/prop" }] } },
      ],
      nextPageToken: "",
    });
    mocks.createMemo.mockResolvedValue({});
    const { result } = renderImportHook();

    await act(() =>
      result.current.start([
        row({ url: "https://example.com/bare" }),
        row({ url: "https://example.com/auto" }),
        row({ url: "https://example.com/prop" }),
        row({ url: "https://example.com/new" }),
      ]),
    );
    await waitFor(() => expect(result.current.progress.status).toBe("done"));

    expect(mocks.createMemo).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toMatchObject({ total: 4, created: 1, skipped: 3, failed: 0 });
  });
});

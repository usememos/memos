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

vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/alice" }) }));

vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: "spaces/reading" }) }));

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
    expect(mocks.listMemos).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filter: 'has_link && creator == "users/alice"', state: 1, orderBy: "id asc" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.listMemos).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filter: 'has_link && creator == "users/alice"', state: 2, orderBy: "id asc" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("deduplicates URLs found only in archived memos", async () => {
    mocks.listMemos
      .mockResolvedValueOnce({ memos: [], nextPageToken: "" })
      .mockResolvedValueOnce({ memos: [{ content: "[Archived](https://example.com/a)" }], nextPageToken: "" });
    const { result } = renderImportHook();

    await act(() => result.current.start([row()]));

    expect(mocks.createMemo).not.toHaveBeenCalled();
    expect(result.current.progress).toMatchObject({ status: "done", skipped: 1 });
  });

  it("does not write when the archived scan fails", async () => {
    mocks.listMemos.mockResolvedValueOnce({ memos: [], nextPageToken: "" }).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderImportHook();

    await act(() => result.current.start([row()]));

    expect(mocks.createMemo).not.toHaveBeenCalled();
    expect(result.current.progress.status).toBe("error");
  });

  it("keeps sensitive URL and error details out of browser logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createMemo.mockRejectedValue(
      new Error("https://sample-user:sample-pass@example.test/private-path?token=sample-secret#sample-fragment"),
    );
    const { result } = renderImportHook();

    await act(() =>
      result.current.start([row({ url: "https://sample-user:sample-pass@example.test/private-path?token=sample-secret#sample-fragment" })]),
    );

    const output = log.mock.calls.flat().join(" ");
    for (const secret of ["sample-user", "sample-pass", "private-path", "sample-secret", "sample-fragment"]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("bookmark import row 1 failed: request_failed");
    log.mockRestore();
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
    expect(mocks.createMemo).toHaveBeenCalledWith(expect.objectContaining({ memo: expect.objectContaining({ space: "spaces/reading" }) }));
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
  it("skips repeated URLs within one file", async () => {
    const { result } = renderImportHook();
    await act(() => result.current.start([row(), row()]));
    expect(mocks.createMemo).toHaveBeenCalledTimes(1);
    expect(result.current.progress.skipped).toBe(1);
  });

  it("does not import when checking existing URLs fails", async () => {
    mocks.listMemos.mockRejectedValue(new Error("offline"));
    const { result } = renderImportHook();
    await act(() => result.current.start([row()]));
    expect(mocks.createMemo).not.toHaveBeenCalled();
    expect(result.current.progress.status).toBe("error");
  });

  it("stops pagination and reports cancellation during dedupe", async () => {
    const page = Promise.withResolvers<{ memos: []; nextPageToken: string }>();
    mocks.listMemos.mockReturnValue(page.promise);
    const { result } = renderImportHook();
    let run: Promise<void>;
    act(() => {
      run = result.current.start([row()]);
    });
    act(() => result.current.cancel());
    await act(async () => {
      page.resolve({ memos: [], nextPageToken: "next" });
      await run;
    });
    expect(mocks.listMemos).toHaveBeenCalledTimes(1);
    expect(mocks.createMemo).not.toHaveBeenCalled();
    expect(result.current.progress.status).toBe("cancelled");
  });

  it("does not publish stale completion after reset", async () => {
    const page = Promise.withResolvers<{ memos: []; nextPageToken: string }>();
    mocks.listMemos.mockReturnValue(page.promise);
    const { result } = renderImportHook();
    let run: Promise<void>;
    act(() => {
      run = result.current.start([row()]);
    });
    act(() => result.current.reset());
    await act(async () => {
      page.resolve({ memos: [], nextPageToken: "" });
      await run;
    });
    expect(result.current.progress.status).toBe("idle");
    expect(mocks.createMemo).not.toHaveBeenCalled();
  });
  it("finishes in-flight writes but does not schedule more after cancellation", async () => {
    const pending = Promise.withResolvers<object>();
    mocks.createMemo.mockReturnValue(pending.promise);
    const { result } = renderImportHook();
    let run: Promise<void>;
    act(() => {
      run = result.current.start(Array.from({ length: 5 }, (_, index) => row({ url: `https://example.com/${index}` })));
    });
    await waitFor(() => expect(mocks.createMemo).toHaveBeenCalledTimes(3));
    act(() => result.current.cancel());
    await act(async () => {
      pending.resolve({});
      await run;
    });
    expect(mocks.createMemo).toHaveBeenCalledTimes(3);
    expect(result.current.progress).toMatchObject({ status: "cancelled", created: 3, total: 5 });
  });

  it("deduplicates encoded URL destinations against the original CSV URL", async () => {
    mocks.listMemos.mockResolvedValue({ memos: [{ content: "[Existing](https://example.com/a%28b%29)" }], nextPageToken: "" });
    const { result } = renderImportHook();
    await act(() => result.current.start([row({ url: "https://example.com/a(b)" })]));
    expect(mocks.createMemo).not.toHaveBeenCalled();
  });
  it("does not invent a duplicate by truncating a balanced-parenthesis URL", async () => {
    mocks.listMemos.mockResolvedValue({
      memos: [{ content: "[Existing](https://example.com/a(b))", property: { links: [{ url: "https://example.com/a(b)" }] } }],
      nextPageToken: "",
    });
    mocks.createMemo.mockResolvedValue({});
    const { result } = renderImportHook();
    await act(() => result.current.start([row({ url: "https://example.com/a(b" }), row({ url: "https://example.com/a(b)" })]));
    expect(mocks.createMemo).toHaveBeenCalledTimes(1);
    expect(mocks.createMemo).toHaveBeenCalledWith(
      expect.objectContaining({ memo: expect.objectContaining({ content: expect.stringContaining("https://example.com/a%28b)") }) }),
    );
    expect(result.current.progress).toMatchObject({ created: 1, skipped: 1 });
  });

  it("deduplicates reference links beyond the metadata enrichment limit", async () => {
    mocks.listMemos.mockResolvedValue({
      memos: [{ content: "[Existing][source]\n\n[source]: https://example.com/reference(a)", property: { links: [] } }],
      nextPageToken: "",
    });
    const { result } = renderImportHook();
    await act(() => result.current.start([row({ url: "https://example.com/reference(a)" })]));
    expect(mocks.createMemo).not.toHaveBeenCalled();
  });
});

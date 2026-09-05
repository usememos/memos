import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuickFindFilters } from "@/components/AppSidebar/QuickFindDialog";
import { buildMemoFilter } from "@/hooks/useMemoFilters";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { shouldRetry } from "@/lib/query-client";

const listMemos = vi.hoisted(() => vi.fn());
vi.mock("@/connect", () => ({ memoServiceClient: { listMemos }, userServiceClient: {}, memoViewServiceClient: {} }));

const createWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: shouldRetry, retryDelay: 0 } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe("memo search requests", () => {
  beforeEach(() => {
    listMemos.mockReset();
  });

  it.each([
    "content.contains('urgent')",
    'tags.exists(t, t.startsWith("work/"))',
    'content.matches("(?i)urgent")',
    "space == null",
  ])("sends server-supported CEL without interpreting it: %s", async (expression) => {
    listMemos.mockResolvedValue({ memos: [], nextPageToken: "" });
    const filter = buildMemoFilter({ filters: buildQuickFindFilters(expression, [], true, "cel"), includePinned: false });
    const { result } = renderHook(() => useInfiniteMemos({ filter }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMemos).toHaveBeenCalledWith(expect.objectContaining({ filter: `(${expression})` }));
    expect(result.current.data?.pages[0].memos).toEqual([]);
  });

  it.each([
    Code.InvalidArgument,
    Code.PermissionDenied,
    Code.Unauthenticated,
  ])("does not retry terminal search errors (%i)", async (code) => {
    listMemos.mockRejectedValue(new ConnectError("rejected", code));
    const { result } = renderHook(() => useInfiniteMemos({ filter: "invalid" }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listMemos).toHaveBeenCalledOnce();
  });

  it("recovers when the invalid query is edited", async () => {
    listMemos
      .mockRejectedValueOnce(new ConnectError("invalid expression", Code.InvalidArgument))
      .mockResolvedValue({ memos: [], nextPageToken: "" });
    const { result, rerender } = renderHook(({ filter }) => useInfiniteMemos({ filter }), {
      wrapper: createWrapper(),
      initialProps: { filter: "invalid" },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    rerender({ filter: "pinned" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.error).toBeNull();
    expect(listMemos).toHaveBeenCalledTimes(2);
  });

  it("retains the existing single retry for transient failures", async () => {
    listMemos.mockRejectedValueOnce(new ConnectError("offline", Code.Unavailable)).mockResolvedValue({ memos: [], nextPageToken: "" });
    const { result } = renderHook(() => useInfiniteMemos({ filter: "pinned" }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMemos).toHaveBeenCalledTimes(2);
  });
});

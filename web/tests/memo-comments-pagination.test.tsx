import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMemoComments = vi.hoisted(() => vi.fn());

vi.mock("@/connect", () => ({
  memoServiceClient: {
    listMemoComments,
  },
}));

import { useInfiniteMemoComments } from "@/hooks/useMemoQueries";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("useInfiniteMemoComments", () => {
  beforeEach(() => {
    listMemoComments.mockReset();
  });

  it("follows nextPageToken and flattens every fetched comment page", async () => {
    listMemoComments
      .mockResolvedValueOnce({
        memos: [{ name: "memos/comment-1" }, { name: "memos/comment-2" }],
        nextPageToken: "page-2",
      })
      .mockResolvedValueOnce({
        memos: [{ name: "memos/comment-3" }],
        nextPageToken: "",
      });

    const { result } = renderHook(() => useInfiniteMemoComments("memos/parent", { pageSize: 2 }), { wrapper });

    await waitFor(() => expect(result.current.data?.map((memo) => memo.name)).toEqual(["memos/comment-1", "memos/comment-2"]));
    expect(listMemoComments).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: "memos/parent", pageSize: 2, pageToken: "" }));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() =>
      expect(result.current.data?.map((memo) => memo.name)).toEqual(["memos/comment-1", "memos/comment-2", "memos/comment-3"]),
    );
    expect(listMemoComments).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "memos/parent", pageSize: 2, pageToken: "page-2" }),
    );
    expect(result.current.hasNextPage).toBe(false);
  });
});

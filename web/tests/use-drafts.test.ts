// T5 — server-side draft-memo feature: useDrafts hook (RED today).
//
// Pins the useDrafts contract BEFORE the hook exists. Per the user-directed
// deviation from contract §5.2, useDrafts must MIRROR useInfiniteMemos (NOT the
// flat useQuery/useMemos shape): a useInfiniteQuery with
//   queryKey: memoKeys.list({ ...request, state: State.DRAFT })
// a fixed pageSize: 20, and pageToken / getNextPageParam from nextPageToken.
//
// Uses @testing-library/react renderHook + a real QueryClientProvider (core
// harness, same React Query setup already used in tests/paged-memo-list.test.tsx)
// and stubs the connect client to capture the outgoing ListMemos request.
//
// Expected status TODAY: every test FAILS because `useDrafts` is not exported
// from @/hooks/useMemoQueries (TypeError: useDrafts is not a function).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMemosMock = vi.fn(async () => ({ memos: [], nextPageToken: "" }));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    listMemos: (req: unknown) => listMemosMock(req as never),
  },
}));

import * as memoQueries from "@/hooks/useMemoQueries";
import { memoKeys } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/v1/common_pb";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

describe("useDrafts (T5, RED today)", () => {
  beforeEach(() => {
    listMemosMock.mockClear();
    listMemosMock.mockResolvedValue({ memos: [], nextPageToken: "" });
  });

  it("is exported from @/hooks/useMemoQueries", () => {
    expect(typeof (memoQueries as { useDrafts?: unknown }).useDrafts).toBe("function");
  });

  it("issues a ListMemos with state=DRAFT and a fixed pageSize of 20", async () => {
    const useDrafts = (memoQueries as { useDrafts?: (r?: unknown) => unknown }).useDrafts;
    expect(typeof useDrafts).toBe("function");

    renderHook(() => useDrafts!({}), { wrapper: wrapper() });

    await waitFor(() => expect(listMemosMock).toHaveBeenCalled());
    const req = listMemosMock.mock.calls[0][0] as { state?: State; pageSize?: number };
    expect(req.state).toBe(State.DRAFT);
    expect(req.pageSize).toBe(20);
  });

  it("uses queryKey deep-equal to memoKeys.list({ ...request, state: State.DRAFT })", () => {
    const useDrafts = (memoQueries as { useDrafts?: (r?: unknown) => { queryKey?: unknown } | unknown }).useDrafts;
    expect(typeof useDrafts).toBe("function");

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    renderHook(() => useDrafts!({ pageSize: 20 }), { wrapper: wrap });

    const expectedKey = memoKeys.list({ pageSize: 20, state: State.DRAFT });
    const cached = client.getQueryCache().findAll();
    const match = cached.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(expectedKey));
    expect(match, "a query registered under memoKeys.list({...request, state: DRAFT})").toBeTruthy();
  });

  it("is a useInfiniteQuery (exposes fetchNextPage/hasNextPage), not a flat useQuery", async () => {
    const useDrafts = (memoQueries as { useDrafts?: (r?: unknown) => Record<string, unknown> }).useDrafts;
    expect(typeof useDrafts).toBe("function");

    const { result } = renderHook(() => useDrafts!({}), { wrapper: wrapper() });

    await waitFor(() => expect(listMemosMock).toHaveBeenCalled());
    // useInfiniteQuery result carries these; a flat useQuery result does not.
    expect(typeof result.current.fetchNextPage).toBe("function");
    expect("hasNextPage" in result.current).toBe(true);
  });
});

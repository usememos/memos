import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMemoInCollectionQueries, memoKeys, useCreateMemo, useMemoByName, useMemoRecord, useUpdateMemo } from "@/hooks/useMemoQueries";
import { memoShareKeys } from "@/hooks/useMemoShareQueries";
import { ListMemoCommentsResponseSchema, ListMemosResponseSchema, type Memo, MemoSchema } from "@/types/proto/api/memo_service_pb";

const api = vi.hoisted(() => ({ getMemo: vi.fn(), updateMemo: vi.fn(), createMemo: vi.fn(), createMemoComment: vi.fn() }));
vi.mock("@/connect", () => ({ memoServiceClient: api }));

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

const memo = (name: string, content = name): Memo => create(MemoSchema, { name, content });

describe("useMemoRecord", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads a memo from an infinite list page without a request", () => {
    const { client, wrapper } = setup();
    const listed = memo("memos/listed");
    client.setQueryData(memoKeys.list({}), { pages: [create(ListMemosResponseSchema, { memos: [listed] })], pageParams: [""] });

    const { result } = renderHook(() => useMemoRecord(listed.name), { wrapper });

    expect(result.current).toBe(listed);
    expect(api.getMemo).not.toHaveBeenCalled();
  });

  it("reads a memo from comment pages, the calendar month and a shared memo", () => {
    const { client, wrapper } = setup();
    const comment = memo("memos/comment");
    const monthly = memo("memos/monthly");
    const shared = memo("memos/shared");
    client.setQueryData([...memoKeys.comments("memos/parent"), "infinite", 50], {
      pages: [create(ListMemoCommentsResponseSchema, { comments: [comment] })],
      pageParams: [""],
    });
    client.setQueryData([...memoKeys.lists(), "calendar-month", { filter: "", orderBy: "" }], [monthly]);
    client.setQueryData(memoShareKeys.byShare("token"), shared);

    const { result } = renderHook(
      () => [useMemoRecord(comment.name), useMemoRecord(monthly.name), useMemoRecord(shared.name), useMemoRecord("memos/none")],
      { wrapper },
    );

    expect(result.current).toEqual([comment, monthly, shared, undefined]);
  });

  it("prefers the copy fetched most recently", () => {
    const { client, wrapper } = setup();
    const stale = memo("memos/x", "old");
    const fresh = memo("memos/x", "new");
    client.setQueryData(memoKeys.detail(stale.name), stale, { updatedAt: 1_000 });
    client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [fresh] }), { updatedAt: 2_000 });

    const { result } = renderHook(() => useMemoRecord(stale.name), { wrapper });

    expect(result.current).toBe(fresh);
  });

  it("follows the list's refetch and a mutation's optimistic patch", async () => {
    const { client, wrapper } = setup();
    const before = memo("memos/x", "before");
    client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [before] }));
    let resolve!: (memo: Memo) => void;
    api.updateMemo.mockImplementation(
      () =>
        new Promise<Memo>((done) => {
          resolve = done;
        }),
    );

    const { result } = renderHook(() => ({ record: useMemoRecord(before.name), update: useUpdateMemo() }), { wrapper });
    expect(result.current.record?.content).toBe("before");

    act(() => {
      client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [memo("memos/x", "refetched")] }));
    });
    expect(result.current.record?.content).toBe("refetched");

    act(() => result.current.update.mutate({ update: { name: before.name, content: "edited" }, updateMask: ["content"] }));
    // The optimistic patch, before the server answers.
    await waitFor(() => expect(result.current.record?.content).toBe("edited"));
    expect(result.current.update.isSuccess).toBe(false);
    await act(async () => resolve(memo("memos/x", "edited")));
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(result.current.record?.content).toBe("edited");
  });

  it("patches an edited comment inside its comment page", async () => {
    const { client, wrapper } = setup();
    const comment = create(MemoSchema, { name: "memos/c", parent: "memos/p", content: "before" });
    const key = [...memoKeys.comments("memos/p"), 0];
    client.setQueryData(key, create(ListMemoCommentsResponseSchema, { comments: [comment] }));
    api.updateMemo.mockImplementation(async ({ memo: update }: { memo: Memo }) => ({ ...comment, ...update }));

    const { result } = renderHook(() => useUpdateMemo(), { wrapper });
    act(() => result.current.mutate({ update: { name: comment.name, content: "after" }, updateMask: ["content"] }));
    await waitFor(() => expect(client.getQueryData<{ comments: Memo[] }>(key)?.comments[0].content).toBe("after"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(findMemoInCollectionQueries(client, comment.name)?.content).toBe("after");
  });

  it("reports a memo recorded as unavailable", () => {
    const { client, wrapper } = setup();
    client.setQueryData(memoKeys.detail("memos/gone"), null);
    client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [memo("memos/gone")] }));

    const { result } = renderHook(() => useMemoRecord("memos/gone"), { wrapper });

    expect(result.current).toBeNull();
  });
});

describe("useMemoByName", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fetches the detail once when no query holds the memo, then reads the cache", async () => {
    const { client, wrapper } = setup();
    const fetched = memo("memos/deep");
    api.getMemo.mockResolvedValue(fetched);

    const { result } = renderHook(() => useMemoByName(fetched.name), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(fetched));

    expect(api.getMemo).toHaveBeenCalledOnce();
    expect(client.getQueryData(memoKeys.detail(fetched.name))).toEqual(fetched);
    await act(async () => {
      await client.invalidateQueries({ queryKey: memoKeys.all, refetchType: "active" });
    });
    expect(api.getMemo).toHaveBeenCalledOnce();
  });

  it("costs no request when a list already holds the memo", () => {
    const { client, wrapper } = setup();
    const listed = memo("memos/listed");
    client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [listed] }));

    const { result } = renderHook(() => useMemoByName(listed.name), { wrapper });

    expect(result.current.data).toBe(listed);
    expect(result.current.isLoading).toBe(false);
    expect(api.getMemo).not.toHaveBeenCalled();
  });
});

describe("useCreateMemo", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a comment through the parent and refreshes the parent's comments", async () => {
    const { client, wrapper } = setup();
    const created = create(MemoSchema, { name: "memos/new", parent: "memos/p", content: "hi" });
    api.createMemoComment.mockResolvedValue(created);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateMemo(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ memo: memo("", "hi"), parent: "memos/p" });
    });

    expect(api.createMemoComment).toHaveBeenCalledWith({ parent: "memos/p", comment: expect.objectContaining({ content: "hi" }) });
    expect(api.createMemo).not.toHaveBeenCalled();
    expect(client.getQueryData(memoKeys.detail(created.name))).toEqual(created);
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(memoKeys.comments("memos/p"));
    expect(keys).toContainEqual(memoKeys.detail("memos/p"));
  });

  it("creates a top-level memo without touching any comment query", async () => {
    const { client, wrapper } = setup();
    const created = memo("memos/new", "hi");
    api.createMemo.mockResolvedValue(created);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateMemo(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ memo: memo("", "hi") });
    });

    expect(api.createMemo).toHaveBeenCalledWith({ memo: expect.objectContaining({ content: "hi" }) });
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[1])).not.toContain("comments");
  });
});

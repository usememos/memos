import { create } from "@bufbuild/protobuf";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import {
  findMemoInCollectionQueries,
  memoKeys,
  useCreateMemo,
  useMemo,
  useMemoByName,
  useMemoRecord,
  useMemos,
  useUpdateMemo,
} from "@/hooks/useMemoQueries";
import { memoShareKeys } from "@/hooks/useMemoShareQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { ListMemoCommentsResponseSchema, ListMemosResponseSchema, type Memo, MemoSchema } from "@/types/proto/api/memo_service_pb";

const api = vi.hoisted(() => ({
  getMemo: vi.fn(),
  listMemos: vi.fn(),
  updateMemo: vi.fn(),
  createMemo: vi.fn(),
  createMemoComment: vi.fn(),
}));
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

    const { result } = renderHook(() => ({ record: useMemoRecord(before.name), update: useUpdateMemo(before.name) }), { wrapper });
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

    const { result } = renderHook(() => useUpdateMemo(comment.name), { wrapper });
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

describe("useUpdateMemo", () => {
  beforeEach(() => vi.resetAllMocks());

  // Pin, then unpin before the first reply: two updates of one memo in flight, as a quick second click makes them.
  const pinThenUnpin = () => {
    const { client, wrapper } = setup();
    const target = memo("memos/x");
    client.setQueryData(memoKeys.detail(target.name), target);
    const replies: Array<() => void> = [];
    api.updateMemo.mockImplementation(
      ({ memo: update }: { memo: Memo }) =>
        new Promise<Memo>((done) => replies.push(() => done(create(MemoSchema, { ...target, pinned: update.pinned })))),
    );
    const { result } = renderHook(() => ({ record: useMemoRecord(target.name), update: useUpdateMemo(target.name) }), { wrapper });
    act(() => {
      result.current.update.mutate({ update: { name: target.name, pinned: true }, updateMask: ["pinned"] });
      result.current.update.mutate({ update: { name: target.name, pinned: false }, updateMask: ["pinned"] });
    });
    // Answers one waiting request: the newest (pop) or the oldest (shift), once every request that can be sent is.
    const answer = async (pick: "newest" | "oldest") => {
      await act(async () => {
        await new Promise((done) => setTimeout(done, 0));
      });
      await waitFor(() => expect(replies.length).toBeGreaterThan(0));
      await act(async () => (pick === "newest" ? replies.pop() : replies.shift())?.());
    };
    return { client, target, result, answer };
  };

  it("keeps the newer change when the older reply arrives last", async () => {
    const { client, target, result, answer } = pinThenUnpin();
    await waitFor(() => expect(result.current.record?.pinned).toBe(false));

    await answer("newest");
    await answer("newest");
    await waitFor(() => expect(client.isMutating()).toBe(0));

    expect(api.updateMemo.mock.calls.map(([request]) => request.memo.pinned)).toEqual([true, false]);
    expect(client.getQueryData<Memo>(memoKeys.detail(target.name))?.pinned).toBe(false);
    expect(result.current.record?.pinned).toBe(false);
  });

  it("does not show the older reply while the newer update is still saving", async () => {
    const { client, result, answer } = pinThenUnpin();
    await waitFor(() => expect(result.current.record?.pinned).toBe(false));

    await answer("oldest");
    expect(result.current.record?.pinned).toBe(false);

    await answer("oldest");
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.record?.pinned).toBe(false);
  });

  it("sends the queued update when the older reply lands while the page is hidden", async () => {
    const { client, result, answer } = pinThenUnpin();
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(1));

    // The tab is left right after the second click: the unpin must not wait for the return.
    focusManager.setFocused(false);
    try {
      await answer("oldest");
      await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(2));
      await answer("oldest");
      await waitFor(() => expect(client.isMutating()).toBe(0));
    } finally {
      focusManager.setFocused(undefined);
    }
    expect(result.current.record?.pinned).toBe(false);
  });

  it("sends a memo's updates in the order they were made, whatever each does before it is sent", async () => {
    const { client, wrapper } = setup();
    const target = memo("memos/x");
    client.setQueryData(memoKeys.detail(target.name), target);
    const replies: Array<() => void> = [];
    api.updateMemo.mockImplementation(
      ({ memo: update }: { memo: Memo }) =>
        new Promise<Memo>((done) => replies.push(() => done(create(MemoSchema, { ...target, ...update })))),
    );
    const { result } = renderHook(() => useUpdateMemo(target.name), { wrapper });

    // A move patches nothing before it is sent, so it is ready to send before the pin made ahead of it.
    act(() => {
      result.current.mutate({ update: { name: target.name, pinned: true }, updateMask: ["pinned"] });
      result.current.mutate({ update: { name: target.name, space: "spaces/b" }, updateMask: ["space"] });
    });
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(1));
    await act(async () => replies[0]());
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(2));
    await act(async () => replies[1]());
    await waitFor(() => expect(client.isMutating()).toBe(0));

    expect(api.updateMemo.mock.calls.map(([request]) => request.updateMask.paths)).toEqual([["pinned"], ["space"]]);
  });

  // A detail page and a list on screen, and a fake server that answers both from what it has saved.
  const onScreen = async (before: Memo) => {
    const { client, wrapper } = setup();
    const server = { memo: before };
    api.getMemo.mockImplementation(async () => server.memo);
    api.listMemos.mockImplementation(async () => create(ListMemosResponseSchema, { memos: [server.memo] }));
    client.setQueryData(memoKeys.detail(before.name), before);
    const rendered = renderHook(() => ({ detail: useMemo(before.name), list: useMemos(), update: useUpdateMemo(before.name) }), {
      wrapper,
    });
    await waitFor(() => expect(rendered.result.current.list.data?.memos).toHaveLength(1));
    return { client, server, result: rendered.result };
  };

  it("ends on the server's state when the queued update fails after the older one saved", async () => {
    const before = create(MemoSchema, { name: "memos/x", content: "- [ ] a", snippet: "[ ] a", property: { hasIncompleteTasks: true } });
    // The server derives the snippet and the property from the content, so only its replies carry them.
    const saved = create(MemoSchema, { name: before.name, content: "- [x] a", snippet: "[x] a", property: { hasIncompleteTasks: false } });
    const { client, server, result } = await onScreen(before);
    api.updateMemo
      .mockImplementationOnce(async () => {
        server.memo = saved;
        return saved;
      })
      .mockRejectedValueOnce(new Error("pin failed"));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    act(() => {
      result.current.update.mutate({ update: { name: before.name, content: saved.content }, updateMask: ["content"] });
      result.current.update.mutate({ update: { name: before.name, pinned: true }, updateMask: ["pinned"] });
    });
    await waitFor(() => expect(client.isMutating()).toBe(0));

    await waitFor(() => expect(result.current.detail.data?.snippet).toBe(saved.snippet));
    expect(result.current.detail.data?.property?.hasIncompleteTasks).toBe(false);
    expect(result.current.detail.data?.pinned).toBe(false);
    await waitFor(() => expect(result.current.list.data?.memos[0].snippet).toBe(saved.snippet));
    expect(result.current.list.data?.memos[0].property?.hasIncompleteTasks).toBe(false);
    // The saved update refreshes what holds no memo itself, whatever the update behind it does.
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(userKeys.stats());
    expect(keys).toContainEqual(attachmentKeys.lists());
  });

  it("sends no refetch that could answer after the newer reply when the older update fails", async () => {
    const before = memo("memos/x");
    const { client, server, result } = await onScreen(before);
    // A refetch answers with what the server held when it was asked, however late.
    const refetches: Array<() => void> = [];
    api.getMemo.mockImplementation(() => {
      const held = server.memo;
      return new Promise<Memo>((done) => refetches.push(() => done(held)));
    });
    api.updateMemo.mockRejectedValueOnce(new Error("edit failed")).mockImplementationOnce(async () => {
      server.memo = create(MemoSchema, { ...before, pinned: true });
      return server.memo;
    });

    act(() => {
      result.current.update.mutate({ update: { name: before.name, content: "edited" }, updateMask: ["content"] });
      result.current.update.mutate({ update: { name: before.name, pinned: true }, updateMask: ["pinned"] });
    });
    await waitFor(() => expect(client.isMutating()).toBe(0));
    await act(async () => {
      refetches.forEach((answer) => answer());
      await new Promise((done) => setTimeout(done, 0));
    });

    expect(client.getQueryData<Memo>(memoKeys.detail(before.name))?.pinned).toBe(true);
    expect(result.current.detail.data?.pinned).toBe(true);
  });

  it("keeps a queued update's optimistic patch when the older update fails and rolls back", async () => {
    const before = memo("memos/x");
    const { client, result } = await onScreen(before);
    const pinReply: Array<() => void> = [];
    api.updateMemo
      .mockRejectedValueOnce(new Error("edit failed"))
      .mockImplementationOnce(
        () => new Promise<Memo>((done) => pinReply.push(() => done(create(MemoSchema, { ...before, pinned: true })))),
      );

    act(() => {
      result.current.update.mutate({ update: { name: before.name, content: "edited" }, updateMask: ["content"] });
      result.current.update.mutate({ update: { name: before.name, pinned: true }, updateMask: ["pinned"] });
    });
    // The edit has failed and rolled back; the pin's reply has not come.
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });

    expect(result.current.detail.data).toMatchObject({ content: before.content, pinned: true });
    expect(result.current.list.data?.memos[0]).toMatchObject({ content: before.content, pinned: true });

    await act(async () => pinReply[0]());
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.detail.data).toMatchObject({ content: before.content, pinned: true });
  });

  it("rolls back to the memo as it was when two updates in a row fail and the refetch fails too", async () => {
    const before = memo("memos/x");
    const { client, result } = await onScreen(before);
    api.updateMemo.mockRejectedValue(new Error("down"));
    api.getMemo.mockRejectedValue(new Error("down"));
    api.listMemos.mockRejectedValue(new Error("down"));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    // The second update's snapshot is taken over the first one's optimistic patch.
    act(() => {
      result.current.update.mutate({ update: { name: before.name, content: "edited" }, updateMask: ["content"] });
      result.current.update.mutate({
        update: { name: before.name, content: "edited again", pinned: true },
        updateMask: ["content", "pinned"],
      });
    });
    await waitFor(() => expect(client.isMutating()).toBe(0));
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(result.current.detail.data).toMatchObject({ content: before.content, pinned: false });
    expect(result.current.list.data?.memos[0]).toMatchObject({ content: before.content, pinned: false });
    // A failed update refetches the memo and what lists it, not every query under the memo root.
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(memoKeys.detail(before.name));
    expect(keys).toContainEqual(memoKeys.lists());
    expect(keys).not.toContainEqual(memoKeys.all);
  });

  it("sends an update of another memo while one memo's update is unanswered", async () => {
    const { wrapper } = setup();
    api.updateMemo.mockImplementation(() => new Promise<Memo>(() => {}));
    const { result } = renderHook(() => ({ a: useUpdateMemo("memos/a"), b: useUpdateMemo("memos/b") }), { wrapper });

    act(() => {
      result.current.a.mutate({ update: { name: "memos/a", pinned: true }, updateMask: ["pinned"] });
      result.current.b.mutate({ update: { name: "memos/b", pinned: true }, updateMask: ["pinned"] });
    });

    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(2));
  });

  it("sends a queued update when the hook of the update in front of it moves to another memo", async () => {
    const { wrapper } = setup();
    const replies: Array<() => void> = [];
    api.updateMemo.mockImplementation(
      ({ memo: update }: { memo: Memo }) =>
        new Promise<Memo>((done) => replies.push(() => done(create(MemoSchema, { name: update.name })))),
    );
    const { result, rerender } = renderHook(({ name }) => ({ moving: useUpdateMemo(name), staying: useUpdateMemo("memos/a") }), {
      wrapper,
      initialProps: { name: "memos/a" },
    });
    act(() => {
      result.current.moving.mutate({ update: { name: "memos/a", content: "edited" }, updateMask: ["content"] });
      result.current.staying.mutate({ update: { name: "memos/a", pinned: true }, updateMask: ["pinned"] });
    });
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(1));

    rerender({ name: "memos/b" });
    await act(async () => replies[0]());

    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledTimes(2));
  });
});

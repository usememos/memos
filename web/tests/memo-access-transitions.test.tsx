import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import { findMemoInCollectionQueries, memoKeys, useMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { ListMemosResponseSchema, MemoRelation_Type, MemoRelationSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const api = vi.hoisted(() => ({ getMemo: vi.fn(), updateMemo: vi.fn() }));
vi.mock("@/connect", () => ({ memoServiceClient: api }));
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe("memo access transitions", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    Code.PermissionDenied,
    Code.NotFound,
  ])("discards denied parent content and snippets while preserving the comment (%s)", async (code) => {
    const { client, wrapper } = setup();
    const parent = create(MemoSchema, { name: "memos/parent", content: "secret", snippet: "secret" });
    const comment = create(MemoSchema, {
      name: "memos/comment",
      parent: parent.name,
      content: "my comment",
      relations: [
        create(MemoRelationSchema, {
          type: MemoRelation_Type.COMMENT,
          memo: { name: "memos/comment" },
          relatedMemo: { name: parent.name, snippet: "secret" },
        }),
      ],
    });
    client.setQueryData(memoKeys.detail(parent.name), parent, { updatedAt: 1 });
    client.setQueryData(memoKeys.detail(comment.name), comment);
    client.setQueryData(memoKeys.list({}), create(ListMemosResponseSchema, { memos: [parent, comment] }));
    api.getMemo.mockRejectedValue(new ConnectError("denied", code));
    const { result } = renderHook(() => useMemo(parent.name), { wrapper });
    await waitFor(() => expect(result.current.isUnavailable).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(memoKeys.detail(parent.name))).toBeNull();
    expect(findMemoInCollectionQueries(client, parent.name)).toBeUndefined();
    expect(client.getQueryData(memoKeys.detail(comment.name))).toMatchObject({ content: "my comment", parent: parent.name, relations: [] });
    expect(api.getMemo).toHaveBeenCalledOnce();
    api.getMemo.mockResolvedValue(parent);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isUnavailable).toBe(false));
    expect(result.current.data?.content).toBe("secret");
    client.clear();
  });

  it("resolves readable relations even when another relation is denied", async () => {
    const { client, wrapper } = setup();
    api.getMemo.mockImplementation(({ name }) =>
      name === "memos/denied"
        ? Promise.reject(new ConnectError("denied", Code.PermissionDenied))
        : Promise.resolve(create(MemoSchema, { name, snippet: "Readable" })),
    );
    const { result } = renderHook(() => useResolvedRelationMemos(["memos/denied", "memos/readable"]), { wrapper });
    await waitFor(() => expect(result.current["memos/readable"]?.snippet).toBe("Readable"));
    expect(result.current["memos/denied"]).toBeNull();
    client.clear();
  });

  it("retains transient errors as retryable errors instead of marking a memo unavailable", async () => {
    const { client, wrapper } = setup();
    api.getMemo.mockRejectedValue(new ConnectError("offline", Code.Unavailable));
    const { result } = renderHook(() => useMemo("memos/parent"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isUnavailable).toBe(false);
    expect(api.getMemo).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("does not optimistically move a memo before the server accepts it", async () => {
    const { client, wrapper } = setup();
    const memo = create(MemoSchema, { name: "memos/moving", space: "spaces/a" });
    client.setQueryData(memoKeys.detail(memo.name), memo);
    let reject!: (error: Error) => void;
    api.updateMemo.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const { result } = renderHook(() => useUpdateMemo(), { wrapper });
    act(() => result.current.mutate({ update: { name: memo.name, space: "spaces/b" }, updateMask: ["space"] }));
    await waitFor(() => expect(api.updateMemo).toHaveBeenCalledOnce());
    expect(client.getQueryData(memoKeys.detail(memo.name))).toEqual(memo);
    await act(async () => {
      reject(new ConnectError("denied", Code.PermissionDenied));
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(memoKeys.detail(memo.name))).toEqual(memo);
    client.clear();
  });
});

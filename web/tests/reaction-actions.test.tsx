import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReactionActions } from "@/components/MemoReactionListView/hooks";
import { findMemoRecord, memoKeys, useMemoRecord } from "@/hooks/useMemoQueries";
import { ListMemosResponseSchema, type Memo, MemoSchema, type Reaction, ReactionSchema } from "@/types/proto/api/memo_service_pb";

const api = vi.hoisted(() => ({ getMemo: vi.fn(), upsertMemoReaction: vi.fn(), deleteMemoReaction: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@/connect", () => ({ memoServiceClient: api }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/me" }) }));
vi.mock("@/contexts/MentionResolutionContext", () => ({ useResolvedUsersByNames: () => new Map() }));
vi.mock("@/lib/toast", () => ({ showErrorToast: api.showErrorToast }));

const setup = (reactions: Memo["reactions"] = []) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const memo = create(MemoSchema, { name: "memos/x", reactions });
  const listKey = memoKeys.list({});
  client.setQueryData(listKey, { pages: [create(ListMemosResponseSchema, { memos: [memo] })], pageParams: [""] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(
    () => {
      const current = useMemoRecord(memo.name) as Memo;
      return { memo: current, first: useReactionActions({ memo: current }), second: useReactionActions({ memo: current }) };
    },
    { wrapper },
  );
  return { client, listKey, ...hook };
};

describe("useReactionActions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updates list and detail immediately and uses the saved reaction without waiting for a refetch", async () => {
    const { result, client, listKey } = setup();
    const request = Promise.withResolvers<Reaction>();
    api.upsertMemoReaction.mockReturnValue(request.promise);
    act(() => {
      result.current.first.handleReactionClick("👍");
    });
    await waitFor(() => expect(result.current.memo.reactions).toHaveLength(1));
    expect(result.current.first.isPending).toBe(true);
    expect(client.getQueryData<{ pages: { memos: Memo[] }[] }>(listKey)?.pages[0].memos[0].reactions).toHaveLength(1);

    const saved = create(ReactionSchema, { name: "memos/x/reactions/1", creator: "users/me", reactionType: "👍" });
    await act(async () => request.resolve(saved));
    await waitFor(() => expect(result.current.first.isPending).toBe(false));
    expect(findMemoRecord(client, "memos/x")?.reactions).toEqual([saved]);
    expect(api.getMemo).not.toHaveBeenCalled();
  });

  it("blocks overlapping clicks across pickers and pills for the same memo", async () => {
    const { result } = setup();
    const request = Promise.withResolvers<Reaction>();
    api.upsertMemoReaction.mockReturnValue(request.promise);
    act(() => {
      expect(result.current.first.handleReactionClick("👍")).toBe(true);
      expect(result.current.second.handleReactionClick("👍")).toBe(false);
      expect(result.current.second.handleReactionClick("❤️")).toBe(false);
    });
    await waitFor(() => expect(api.upsertMemoReaction).toHaveBeenCalledTimes(1));
    await act(async () => request.resolve(create(ReactionSchema, { creator: "users/me", reactionType: "👍" })));
  });

  it("rolls back a failed add and reports it while keeping unrelated new reactions", async () => {
    const { result, client } = setup();
    const request = Promise.withResolvers<never>();
    api.upsertMemoReaction.mockReturnValue(request.promise);
    act(() => {
      result.current.first.handleReactionClick("👍");
    });
    await waitFor(() => expect(result.current.memo.reactions).toHaveLength(1));
    const incoming = create(ReactionSchema, { name: "memos/x/reactions/2", creator: "users/other", reactionType: "❤️" });
    act(() =>
      client.setQueryData(memoKeys.detail("memos/x"), { ...result.current.memo, reactions: [...result.current.memo.reactions, incoming] }),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => request.reject(new Error("Request failed")));
    await waitFor(() => expect(api.showErrorToast).toHaveBeenCalledWith("Request failed"));
    expect(result.current.memo.reactions).toEqual([incoming]);
    logged.mockRestore();
  });

  it("removes an existing reaction optimistically and restores it on failure", async () => {
    const existing = create(ReactionSchema, { name: "memos/x/reactions/1", creator: "users/me", reactionType: "👍" });
    const { result } = setup([existing]);
    const request = Promise.withResolvers<never>();
    api.deleteMemoReaction.mockReturnValue(request.promise);
    act(() => {
      result.current.first.handleReactionClick("👍");
    });
    await waitFor(() => expect(result.current.memo.reactions).toHaveLength(0));
    expect(api.deleteMemoReaction).toHaveBeenCalledWith({ name: existing.name });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => request.reject(new Error("Delete failed")));
    await waitFor(() => expect(result.current.memo.reactions).toEqual([existing]));
    expect(api.showErrorToast).toHaveBeenCalledWith("Delete failed");
    logged.mockRestore();
  });
});

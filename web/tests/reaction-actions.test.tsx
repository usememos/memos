import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReactionActions } from "@/components/MemoReactionListView/hooks";
import { memoDetailQueryOptions, memoKeys } from "@/hooks/useMemoQueries";
import { type Memo, MemoSchema, ReactionSchema } from "@/types/proto/api/memo_service_pb";

const api = vi.hoisted(() => ({ getMemo: vi.fn(), upsertMemoReaction: vi.fn(), deleteMemoReaction: vi.fn() }));
vi.mock("@/connect", () => ({ memoServiceClient: api }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/me" }) }));
vi.mock("@/contexts/MentionResolutionContext", () => ({ useResolvedUsersByNames: () => new Map() }));

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe("useReactionActions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the newer reactions when the first reaction's refetch answers last", async () => {
    const { client, wrapper } = setup();
    const name = "memos/x";
    client.setQueryData(memoKeys.detail(name), create(MemoSchema, { name, reactions: [] }));
    // The server's reactions, and the replies to getMemo, each holding the reactions saved when it was asked.
    const saved: string[] = [];
    const replies: Array<() => void> = [];
    api.upsertMemoReaction.mockImplementation(async ({ reaction }: { reaction: { reactionType: string } }) => {
      saved.push(reaction.reactionType);
      return create(ReactionSchema, { reactionType: reaction.reactionType });
    });
    api.getMemo.mockImplementation(() => {
      const reactions = saved.map((reactionType) => create(ReactionSchema, { reactionType, creator: "users/me" }));
      return new Promise<Memo>((done) => replies.push(() => done(create(MemoSchema, { name, reactions }))));
    });

    // The detail page: the memo's query is observed, and the reaction picker acts on the memo it shows.
    const { result } = renderHook(
      () => {
        const memo = useQuery(memoDetailQueryOptions(name)).data as Memo;
        return { memo, actions: useReactionActions({ memo }) };
      },
      { wrapper },
    );
    act(() => {
      void result.current.actions.handleReactionClick("👍");
    });
    await waitFor(() => expect(api.getMemo).toHaveBeenCalledTimes(1));
    act(() => {
      void result.current.actions.handleReactionClick("❤️");
    });
    await waitFor(() => expect(api.getMemo).toHaveBeenCalledTimes(2));

    // The second refetch answers first, then the first one, which only knows about 👍.
    await act(async () => replies[1]());
    await act(async () => replies[0]());

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(saved).toEqual(["👍", "❤️"]);
    expect(result.current.memo.reactions.map((reaction) => reaction.reactionType)).toEqual(["👍", "❤️"]);
  });
});

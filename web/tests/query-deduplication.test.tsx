import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MentionResolutionProvider,
  useResolvedMentionUsernames,
  useResolvedUser,
} from "@/components/MemoContent/MentionResolutionContext";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import { memoKeys } from "@/hooks/useMemoQueries";
import { useUser, userKeys, useUsersByNames, useUsersByUsernames } from "@/hooks/useUserQueries";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

const clients = vi.hoisted(() => ({
  batchGetUsers: vi.fn(),
  getMemo: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    getMemo: clients.getMemo,
  },
  shortcutServiceClient: {},
  userServiceClient: {
    batchGetUsers: clients.batchGetUsers,
    getUser: clients.getUser,
  },
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

describe("query deduplication", () => {
  beforeEach(() => {
    clients.batchGetUsers.mockReset();
    clients.getMemo.mockReset();
    clients.getUser.mockReset();
  });

  it("fetches each user name once across individual and overlapping group queries", async () => {
    clients.getUser.mockImplementation(async ({ name }: { name: string }) => ({ name, username: name }) as User);
    const queryClient = createQueryClient();

    const { result } = renderHook(
      () => ({
        individual: useUser("users/1"),
        firstGroup: useUsersByNames(["users/1", "users/2"]),
        secondGroup: useUsersByNames(["users/2", "users/3"]),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.individual.isSuccess).toBe(true);
      expect(result.current.firstGroup.isSuccess).toBe(true);
      expect(result.current.secondGroup.isSuccess).toBe(true);
    });

    expect(clients.getUser.mock.calls.map(([request]) => request.name).sort()).toEqual(["users/1", "users/2", "users/3"]);
  });

  it("seeds user detail queries from a username batch response", async () => {
    const alice = { name: "users/1", username: "alice" } as User;
    clients.batchGetUsers.mockResolvedValue({ users: [alice] });
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const batch = renderHook(() => useUsersByUsernames(["alice"]), { wrapper });
    await waitFor(() => expect(batch.result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(userKeys.detail(alice.name))).toBe(alice);

    const detail = renderHook(() => useUser(alice.name), { wrapper });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(clients.getUser).not.toHaveBeenCalled();
  });

  it("reuses cached user details instead of issuing another username batch", async () => {
    const alice = { name: "users/alice", username: "alice" } as User;
    const queryClient = createQueryClient();
    queryClient.setQueryData(userKeys.detail(alice.name), alice);

    const batch = renderHook(() => useUsersByUsernames(["alice"]), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(batch.result.current.isSuccess).toBe(true));

    expect(batch.result.current.data?.get("alice")).toBe(alice);
    expect(clients.batchGetUsers).not.toHaveBeenCalled();
  });

  it("resolves feed creators and mentions through one shared username batch", async () => {
    const alice = { name: "users/alice", username: "alice" } as User;
    const bob = { name: "users/bob", username: "bob" } as User;
    clients.batchGetUsers.mockResolvedValue({ users: [alice, bob] });
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MentionResolutionProvider contents={["Hello @bob"]} userNames={[alice.name]}>
          {children}
        </MentionResolutionProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({
        creator: useResolvedUser(alice.name),
        mentions: useResolvedMentionUsernames("Hello @bob"),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.creator).toBe(alice);
      expect(result.current.mentions.has("bob")).toBe(true);
    });

    expect(clients.batchGetUsers).toHaveBeenCalledTimes(1);
    expect(clients.batchGetUsers).toHaveBeenCalledWith({ usernames: ["bob", "alice"] });
    expect(clients.getUser).not.toHaveBeenCalled();
  });

  it("reuses memo list data and canonical detail queries when resolving relations", async () => {
    const cachedMemo = { name: "memos/cached", snippet: "Already in the list" } as Memo;
    const missingMemo = { name: "memos/missing", snippet: "Fetched once" } as Memo;
    clients.getMemo.mockResolvedValue(missingMemo);

    const queryClient = createQueryClient();
    queryClient.setQueryData(memoKeys.list({}), {
      pages: [{ memos: [cachedMemo], nextPageToken: "" }],
      pageParams: [""],
    });

    const { result } = renderHook(
      () => ({
        first: useResolvedRelationMemos([cachedMemo.name, missingMemo.name]),
        second: useResolvedRelationMemos([missingMemo.name]),
      }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.first[cachedMemo.name]?.snippet).toBe(cachedMemo.snippet);
      expect(result.current.first[missingMemo.name]?.snippet).toBe(missingMemo.snippet);
      expect(result.current.second[missingMemo.name]?.snippet).toBe(missingMemo.snippet);
    });

    expect(clients.getMemo).toHaveBeenCalledTimes(1);
    expect(clients.getMemo).toHaveBeenCalledWith({ name: missingMemo.name });
  });
});

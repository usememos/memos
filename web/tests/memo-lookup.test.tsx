import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listMemos: vi.fn(), getMemo: vi.fn() }));

vi.mock("@/connect", () => ({ memoServiceClient: api }));

import { memoKeys, useMemoLookup } from "@/hooks/useMemoQueries";

const memo = (name: string) => ({ name, content: name, relations: [], reactions: [] });

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe("useMemoLookup", () => {
  beforeEach(() => {
    api.listMemos.mockReset();
    api.getMemo.mockReset();
  });

  it("fetches the memos several cards name with one list request", async () => {
    api.listMemos.mockResolvedValue({ memos: [memo("memos/a"), memo("memos/b")] });
    api.getMemo.mockRejectedValue(new ConnectError("gone", Code.NotFound));
    const { wrapper } = setup();

    const { result } = renderHook(
      () => ({
        a: useMemoLookup("memos/a"),
        b: useMemoLookup("memos/b"),
        gone: useMemoLookup("memos/gone"),
        aAgain: useMemoLookup("memos/a"),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.a.data?.name).toBe("memos/a"));
    expect(result.current.b.data?.name).toBe("memos/b");
    expect(result.current.aAgain.data?.name).toBe("memos/a");
    expect(api.listMemos).toHaveBeenCalledOnce();
    expect(api.listMemos.mock.calls[0][0]).toMatchObject({ filter: 'name in ["memos/a", "memos/b", "memos/gone"]', pageSize: 3 });

    // The list leaves out a memo that is archived or gone; asking for it by name tells which.
    await waitFor(() => expect(result.current.gone.isUnavailable).toBe(true));
    expect(result.current.gone.data).toBeUndefined();
    expect(api.getMemo).toHaveBeenCalledOnce();
    expect(api.getMemo).toHaveBeenCalledWith({ name: "memos/gone" });
  });

  it("returns a memo the list left out when it is still readable by name", async () => {
    api.listMemos.mockResolvedValue({ memos: [] });
    api.getMemo.mockResolvedValue(memo("memos/archived"));
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoLookup("memos/archived"), { wrapper });

    await waitFor(() => expect(result.current.data?.name).toBe("memos/archived"));
    expect(result.current.isUnavailable).toBe(false);
  });

  it("reads a memo a query already holds without a request, and waits while disabled", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(memoKeys.list({}), { memos: [memo("memos/listed")], nextPageToken: "" });

    const listed = renderHook(() => useMemoLookup("memos/listed"), { wrapper });
    const waiting = renderHook(() => useMemoLookup("memos/far", { enabled: false }), { wrapper });

    expect(listed.result.current.data?.name).toBe("memos/listed");
    expect(waiting.result.current.data).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(api.listMemos).not.toHaveBeenCalled();
    expect(api.getMemo).not.toHaveBeenCalled();
  });

  it("reports a failed lookup instead of calling the memo unavailable", async () => {
    // A refused request is not retried, so the failure surfaces at once.
    api.listMemos.mockRejectedValue(new ConnectError("bad filter", Code.InvalidArgument));
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoLookup("memos/a"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isUnavailable).toBe(false);
    expect(api.getMemo).not.toHaveBeenCalled();
  });
});

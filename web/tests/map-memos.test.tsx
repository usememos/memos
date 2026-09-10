import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMapMemos } from "@/components/MapView/useMapMemos";
import { memoDetailQueryOptions, useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const state = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), delete: vi.fn(), get: vi.fn(), filter: "", settingsReady: true }));
vi.mock("@/connect", () => ({
  memoServiceClient: { listMemos: state.list, updateMemo: state.update, deleteMemo: state.delete, getMemo: state.get },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isUserSettingsInitialized: state.settingsReady }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ memoFilter: 'space == "spaces/travel"' }) }));
vi.mock("@/contexts/ViewContext", () => ({ useView: () => ({ timeBasis: "create_time" }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/qa" }) }));
vi.mock("@/hooks/useMemoFilters", () => ({ useMemoFilters: () => state.filter }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper, ...renderHook(() => useMapMemos(), { wrapper }) };
}
const page = (offset: number, count: number, nextPageToken = "") => ({
  memos: Array.from({ length: count }, (_, index) =>
    create(MemoSchema, { name: `memos/${offset + index}`, location: { latitude: 35, longitude: 135 } }),
  ),
  nextPageToken,
});

describe("map pagination", () => {
  beforeEach(() => {
    state.filter = "";
    state.settingsReady = true;
  });
  it("automatically drains every page and scopes the requests", async () => {
    state.list
      .mockResolvedValueOnce(page(0, 500, "second"))
      .mockResolvedValueOnce(page(500, 500, "third"))
      .mockResolvedValueOnce(page(1000, 12));
    const { result } = setup();
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.memos).toHaveLength(1012);
    expect(state.list.mock.calls.map(([request]) => request.pageToken)).toEqual(["", "second", "third"]);
    const request = state.list.mock.calls[0][0];
    expect(request.pageSize).toBe(500);
    expect(request.filter).toContain('creator == "users/qa"');
    expect(request.filter).toContain('space == "spaces/travel"');
    expect(request.filter).toContain("has_location");
  });
  it("retains partial results without claiming completion and retries the failed page", async () => {
    state.list
      .mockResolvedValueOnce(page(0, 500, "second"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page(500, 2));
    const { result } = setup();
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.complete).toBe(false);
    expect(result.current.memos).toHaveLength(500);
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.memos).toHaveLength(502);
  });
  it("cancels the previous request when filters change", async () => {
    let signal: AbortSignal | undefined;
    state.list
      .mockImplementationOnce((_request, options) => {
        signal = options.signal;
        return new Promise((_resolve, reject) =>
          signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        );
      })
      .mockResolvedValueOnce(page(0, 1));
    const { result, rerender } = setup();
    await waitFor(() => expect(state.list).toHaveBeenCalledOnce());
    state.filter = '"work" in tags';
    rerender();
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(signal?.aborted).toBe(true);
    expect(result.current.memos).toHaveLength(1);
  });
  it("waits for content hiding preferences before requesting memos", () => {
    state.settingsReady = false;
    const { result } = setup();
    expect(state.list).not.toHaveBeenCalled();
    expect(result.current.complete).toBe(false);
  });
  it("reflects location updates and deletion through the shared mutation cache", async () => {
    const original = page(0, 1);
    state.list.mockResolvedValueOnce(original);
    const { result, wrapper } = setup();
    await waitFor(() => expect(result.current.complete).toBe(true));
    const updated = { ...original.memos[0], location: { ...original.memos[0].location!, latitude: 0, longitude: 0 } };
    state.update.mockResolvedValueOnce(updated);
    state.list.mockResolvedValueOnce({ memos: [updated], nextPageToken: "" });
    const mutations = renderHook(() => ({ update: useUpdateMemo(), remove: useDeleteMemo() }), { wrapper });
    await act(async () => {
      await mutations.result.current.update.mutateAsync({ update: updated, updateMask: ["location"] });
    });
    await waitFor(() => expect(result.current.memos[0].location?.latitude).toBe(0));
    state.delete.mockResolvedValueOnce({});
    state.list.mockResolvedValueOnce(page(0, 0));
    await act(async () => {
      await mutations.result.current.remove.mutateAsync(updated.name);
    });
    await waitFor(() => expect(result.current.memos).toHaveLength(0));
  });
  it("removes a denied memo from map pages when detail access expires", async () => {
    state.list.mockResolvedValueOnce(page(0, 1));
    const { client, result } = setup();
    await waitFor(() => expect(result.current.complete).toBe(true));
    state.get.mockRejectedValueOnce(new ConnectError("no longer available", Code.PermissionDenied));
    await act(async () => {
      await client.fetchQuery(memoDetailQueryOptions("memos/0"));
    });
    await waitFor(() => expect(result.current.memos).toHaveLength(0));
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAllUserStats, useUserStats } from "@/hooks/useUserQueries";
import { State } from "@/types/proto/api/v1/common_pb";

const clients = vi.hoisted(() => ({
  getUserStats: vi.fn(),
  listAllUserStats: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoViewServiceClient: {},
  userServiceClient: clients,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("User statistics filter queries", () => {
  beforeEach(() => {
    clients.getUserStats.mockReset().mockResolvedValue({ name: "users/test/stats" });
    clients.listAllUserStats.mockReset().mockResolvedValue({ stats: [] });
  });

  it("sends a Space filter with per-user statistics", async () => {
    const filter = 'space == "spaces/product"';
    const { result } = renderHook(() => useUserStats("users/test", { filter }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clients.getUserStats).toHaveBeenCalledWith({ name: "users/test", filter });
  });

  it("sends the no-Space filter with grouped statistics", async () => {
    const filter = "space == null";
    const { result } = renderHook(() => useAllUserStats({ state: State.ARCHIVED, filter }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clients.listAllUserStats).toHaveBeenCalledWith(expect.objectContaining({ state: State.ARCHIVED, filter }));
  });
});

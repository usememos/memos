import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies BEFORE importing the hook under test.
vi.mock("@/hooks/useUserQueries", () => ({
  useAllUserStats: vi.fn(),
  useUserStats: vi.fn(),
}));
vi.mock("@/hooks/useMemoQueries", () => ({
  useMemos: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/test", id: 1 }),
}));

const mockUseView = vi.fn();
vi.mock("@/contexts/ViewContext", async () => {
  const actual = await vi.importActual<typeof import("@/contexts/ViewContext")>("@/contexts/ViewContext");
  return {
    ...actual,
    useView: () => mockUseView(),
  };
});

import { useAllUserStats, useUserStats } from "@/hooks/useUserQueries";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";

const wrapper = ({ children }: { children: ReactNode }) => children as never;

const ts = (year: number, month: number, day: number) => ({
  seconds: BigInt(Math.floor(Date.UTC(year, month - 1, day) / 1000)),
  nanos: 0,
});

describe("useFilteredMemoStats", () => {
  beforeEach(() => {
    vi.mocked(useAllUserStats).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useAllUserStats>);
    vi.mocked(useUserStats).mockReturnValue({
      data: {
        memoCreatedTimestamps: [ts(2026, 5, 1), ts(2026, 5, 1), ts(2026, 5, 2)],
        memoUpdatedTimestamps: [ts(2026, 5, 3), ts(2026, 5, 3), ts(2026, 5, 3)],
        tagCount: {},
      },
      isLoading: false,
    } as ReturnType<typeof useUserStats>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates by created timestamps when timeBasis is create_time", () => {
    mockUseView.mockReturnValue({
      timeBasis: "create_time",
      orderByTimeAsc: false,
      toggleSortOrder: vi.fn(),
      setTimeBasis: vi.fn(),
    });

    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-01": 2, "2026-05-02": 1 });
    expect(result.current.statistics.timeBasis).toBe("create_time");
  });

  it("aggregates by updated timestamps when timeBasis is update_time", () => {
    mockUseView.mockReturnValue({
      timeBasis: "update_time",
      orderByTimeAsc: false,
      toggleSortOrder: vi.fn(),
      setTimeBasis: vi.fn(),
    });

    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-03": 3 });
    expect(result.current.statistics.timeBasis).toBe("update_time");
  });

  it("falls back to created timestamps when updated array is empty (old server)", () => {
    // Old servers that don't know about the new field deserialize it as [].
    // Length divergence (created non-empty, updated empty) is the signal.
    vi.mocked(useUserStats).mockReturnValue({
      data: {
        memoCreatedTimestamps: [ts(2026, 5, 1)],
        memoUpdatedTimestamps: [],
        tagCount: {},
      },
      isLoading: false,
    } as ReturnType<typeof useUserStats>);
    mockUseView.mockReturnValue({
      timeBasis: "update_time",
      orderByTimeAsc: false,
      toggleSortOrder: vi.fn(),
      setTimeBasis: vi.fn(),
    });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useFilteredMemoStats({ userName: "users/test" }), { wrapper });

    expect(result.current.statistics.activityStats).toEqual({ "2026-05-01": 1 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useUserStats: vi.fn(() => ({ data: undefined })) }));

vi.mock("@/hooks/useUserQueries", () => ({ useUserStats: mocks.useUserStats, useMemoViews: () => ({ data: [] }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { name: "users/alice" }, isUserSettingsInitialized: true }),
}));

import { useWelcomeGuide } from "@/components/WelcomeGuide/useWelcomeGuide";
import { updateDevicePreferences } from "@/hooks/useDevicePreferences";
import { useCommentScopeFilter } from "@/hooks/useMemoFilters";

describe("comment scope", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.useUserStats.mockClear();
  });

  it("keeps comments out of lists and their statistics until the reader includes them", () => {
    const { result } = renderHook(() => useCommentScopeFilter());
    expect(result.current).toBe("parent == null");

    act(() => updateDevicePreferences({ includeComments: true }));
    expect(result.current).toBeUndefined();

    act(() => updateDevicePreferences({ includeComments: false }));
    expect(result.current).toBe("parent == null");
  });

  it("counts only top-level memos when deciding whether an account has any memos yet", () => {
    act(() => updateDevicePreferences({ includeComments: true }));

    renderHook(() => useWelcomeGuide(true));

    // A comment on someone else's memo is not a memo of the account's own, whatever the lists show.
    expect(mocks.useUserStats).toHaveBeenCalledWith("users/alice", { enabled: true, filter: "parent == null" });
  });
});

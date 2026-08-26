import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoActionHandlers } from "@/components/MemoActionMenu/hooks";
import type { MemoOriginScope } from "@/components/MemoView/navigation";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({
  updateMemo: vi.fn(),
  deleteMemo: vi.fn(),
  clearSelectedSpace: vi.fn(),
}));

vi.mock("@/hooks/useMemoQueries", () => ({
  memoKeys: { comments: (name: string) => ["memos", name, "comments"] },
  useUpdateMemo: () => ({ mutateAsync: mocks.updateMemo }),
  useDeleteMemo: () => ({ mutateAsync: mocks.deleteMemo }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  userKeys: { stats: () => ["users", "stats"] },
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: { instanceUrl: "" } }),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ clearSelectedSpace: mocks.clearSelectedSpace }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createMemo = (state: State): Memo =>
  ({
    name: "memos/1",
    content: "memo",
    state,
    parent: "",
  }) as Memo;

const renderActions = (state: State, parentScope: MemoOriginScope) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/memos/1"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  return renderHook(
    () => {
      const location = useLocation();
      const handlers = useMemoActionHandlers({
        memo: createMemo(state),
        parentScope,
        setDeleteDialogOpen: vi.fn(),
      });
      return { handlers, pathname: location.pathname };
    },
    { wrapper },
  );
};

describe("Memo detail mutation navigation", () => {
  beforeEach(() => {
    mocks.updateMemo.mockReset().mockResolvedValue(undefined);
    mocks.deleteMemo.mockReset().mockResolvedValue(undefined);
    mocks.clearSelectedSpace.mockReset();
  });

  it.each([
    [State.NORMAL, "/archived"],
    [State.ARCHIVED, "/"],
  ])("switches an All-origin %s memo to the user-level destination without changing the remembered Space", async (state, destination) => {
    const { result } = renderActions(state, "all");

    await act(async () => {
      await result.current.handlers.handleToggleMemoStatusClick();
    });

    await waitFor(() => expect(result.current.pathname).toBe(destination));
    expect(mocks.clearSelectedSpace).not.toHaveBeenCalled();
  });

  it("preserves an exact-Space origin when archiving", async () => {
    const { result } = renderActions(State.NORMAL, "preserve");

    await act(async () => {
      await result.current.handlers.handleToggleMemoStatusClick();
    });

    await waitFor(() => expect(result.current.pathname).toBe("/archived"));
    expect(mocks.clearSelectedSpace).not.toHaveBeenCalled();
  });

  it("clears a stale Space before deleting from an All origin", async () => {
    const { result } = renderActions(State.NORMAL, "all");

    await act(async () => {
      await result.current.handlers.confirmDeleteMemo();
    });

    await waitFor(() => expect(result.current.pathname).toBe("/"));
    expect(mocks.clearSelectedSpace).toHaveBeenCalledOnce();
  });
});

import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import MemoDetail from "@/pages/MemoDetail";
import { State } from "@/types/proto/api/v1/common_pb";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";

const memoQueryState = vi.hoisted(() => ({ memos: new Map<string, unknown>() }));

vi.mock("@/components/MemoCommentSection", () => ({ default: () => null }));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/MemoView", () => ({
  default: ({
    showBlurredContent,
    onBlurVisibilityChange,
  }: {
    showBlurredContent?: boolean;
    onBlurVisibilityChange?: (show: boolean) => void;
  }) => (
    <button type="button" onClick={() => onBlurVisibilityChange?.(true)}>
      {showBlurredContent ? "revealed" : "reveal"}
    </button>
  ),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isInitialized: true }) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ isInitialized: true }) }));
vi.mock("@/hooks/useMemoDetailError", () => ({ default: () => undefined }));
vi.mock("@/hooks/useMemoQueries", () => ({
  useMemo: (name: string) => ({ data: memoQueryState.memos.get(name), error: null, isLoading: false }),
  useInfiniteMemoComments: () => ({
    data: [],
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));
vi.mock("@/hooks/useMemoShareQueries", () => ({
  useSharedMemo: () => ({ data: undefined, error: null, isLoading: false }),
  withShareAttachmentLinks: (attachments: unknown[]) => attachments,
}));

const Navigation = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/memos/first")}>
        first
      </button>
      <button type="button" onClick={() => navigate("/memos/second")}>
        second
      </button>
    </>
  );
};

const SidebarState = () => {
  const { memoDetail } = useAppSidebar();
  if (!memoDetail) return null;
  return (
    <div data-testid="sidebar-state">{`${memoDetail.memo.name}:${memoDetail.showBlurredContent ? "revealed" : "hidden"}`}</div>
  );
};

describe("MemoDetail blur navigation", () => {
  beforeEach(() => {
    memoQueryState.memos.clear();
    for (const uid of ["first", "second"]) {
      memoQueryState.memos.set(
        `memos/${uid}`,
        create(MemoSchema, {
          name: `memos/${uid}`,
          creator: "users/alice",
          state: State.NORMAL,
          visibility: Visibility.PUBLIC,
          content: `# ${uid}\n\n## Secret details`,
          tags: ["secret"],
        }),
      );
    }
  });

  it("starts blurred again after navigating away from a revealed memo and back", async () => {
    render(
      <MemoryRouter initialEntries={["/memos/first"]}>
        <AppSidebarProvider>
          <Navigation />
          <SidebarState />
          <Routes>
            <Route path="/memos/:uid" element={<MemoDetail />} />
          </Routes>
        </AppSidebarProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("sidebar-state")).toHaveTextContent("memos/first:hidden");
    fireEvent.click(screen.getByRole("button", { name: "reveal" }));
    await waitFor(() => expect(screen.getByTestId("sidebar-state")).toHaveTextContent("memos/first:revealed"));

    fireEvent.click(screen.getByRole("button", { name: "second" }));
    await waitFor(() => expect(screen.getByTestId("sidebar-state")).toHaveTextContent("memos/second:hidden"));

    fireEvent.click(screen.getByRole("button", { name: "first" }));
    await waitFor(() => expect(screen.getByTestId("sidebar-state")).toHaveTextContent("memos/first:hidden"));
  });
});

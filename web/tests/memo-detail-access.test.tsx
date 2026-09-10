import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoKeys } from "@/hooks/useMemoQueries";
import MemoDetail from "@/pages/MemoDetail";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const state = vi.hoisted(() => ({
  currentUser: undefined as { name: string } | undefined,
  getMemo: vi.fn(),
  listMemoComments: vi.fn(),
  setMemoDetail: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/connect", () => ({ memoServiceClient: state }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: state.currentUser, isInitialized: true }) }));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ isInitialized: true }) }));
vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setMemoDetail: state.setMemoDetail }) }));
vi.mock("@/components/MemoView", () => ({ default: ({ memo }: { memo: Memo }) => <article>{memo.content}</article> }));
vi.mock("@/components/MemoView/MemoViewContext", () => ({ computeCommentAmount: () => 0 }));
vi.mock("@/components/MemoCommentSection", () => ({ default: () => null }));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-hot-toast", () => ({ toast: { error: state.toastError } }));

function renderDetail(client: QueryClient, name = "memos/restored") {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/${name}`]}>
        <Routes>
          <Route path="/memos/:uid" element={<MemoDetail />} />
          <Route path="/404" element={<div>not found</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });

describe("memo detail access recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentUser = undefined;
    state.listMemoComments.mockResolvedValue({ memos: [], nextPageToken: "" });
  });

  it.each(["fresh", "stale"])("revalidates a %s cached denial before showing a restored memo", async (freshness) => {
    const client = createClient();
    const name = "memos/restored";
    client.setQueryData(memoKeys.detail(name), null, { updatedAt: freshness === "fresh" ? Date.now() : 1 });
    let resolve!: (memo: Memo) => void;
    let signal!: AbortSignal;
    state.getMemo.mockImplementation((_, options) => {
      signal = options.signal;
      return new Promise<Memo>((done) => {
        resolve = done;
      });
    });
    renderDetail(client);
    await waitFor(() => expect(state.getMemo).toHaveBeenCalledOnce());
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    expect(signal.aborted).toBe(false);
    await act(async () => resolve(create(MemoSchema, { name, content: "Restored memo" })));
    expect(await screen.findByText("Restored memo")).toBeInTheDocument();
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    client.clear();
  });

  it.each([Code.PermissionDenied, Code.NotFound])("redirects only after revalidation confirms denial (%s)", async (code) => {
    const client = createClient();
    client.setQueryData(memoKeys.detail("memos/restored"), null, { updatedAt: 1 });
    let reject!: (error: Error) => void;
    state.getMemo.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    renderDetail(client);
    await waitFor(() => expect(state.getMemo).toHaveBeenCalledOnce());
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    await act(async () => reject(new ConnectError("denied", code)));
    expect(await screen.findByText("not found")).toBeInTheDocument();
    client.clear();
  });

  it("does not treat a failed revalidation as a renewed denial", async () => {
    const client = createClient();
    client.setQueryData(memoKeys.detail("memos/restored"), null, { updatedAt: 1 });
    state.getMemo.mockRejectedValue(new ConnectError("offline", Code.Unavailable));
    renderDetail(client);
    await waitFor(() => expect(state.toastError).toHaveBeenCalled());
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    client.clear();
  });

  it.each([false, true])("classifies parent 401 according to the current viewer (signed in: %s)", async (signedIn) => {
    if (signedIn) state.currentUser = { name: "users/alice" };
    const client = createClient();
    const comment = create(MemoSchema, { name: "memos/comment", content: "Public comment", parent: "memos/private-parent" });
    state.getMemo.mockImplementation(({ name }) =>
      name === comment.name ? Promise.resolve(comment) : Promise.reject(new ConnectError("authentication required", Code.Unauthenticated)),
    );
    renderDetail(client, comment.name);
    expect(await screen.findByText(signedIn ? "memo.parent-load-error" : "memo.parent-unavailable")).toBeInTheDocument();
    expect(screen.getByText("Public comment")).toBeInTheDocument();
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    if (signedIn) expect(screen.getByRole("button", { name: "search.retry" })).toBeInTheDocument();
    else expect(screen.queryByRole("button", { name: "search.retry" })).not.toBeInTheDocument();
    expect(state.setMemoDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parentStatus: signedIn ? "error" : "unavailable",
        parentMemo: undefined,
      }),
    );
    client.clear();
  });

  it("lets a guest retry a transient parent error", async () => {
    const client = createClient();
    const comment = create(MemoSchema, { name: "memos/comment", content: "Public comment", parent: "memos/parent" });
    let parentAvailable = false;
    state.getMemo.mockImplementation(({ name }) =>
      name === comment.name
        ? Promise.resolve(comment)
        : parentAvailable
          ? Promise.resolve(create(MemoSchema, { name, content: "Parent memo" }))
          : Promise.reject(new ConnectError("offline", Code.Unavailable)),
    );
    renderDetail(client, comment.name);
    const retry = await screen.findByRole("button", { name: "search.retry" });
    parentAvailable = true;
    fireEvent.click(retry);
    expect(await screen.findByRole("link", { name: "Parent memo" })).toBeInTheDocument();
    expect(screen.getByText("Public comment")).toBeInTheDocument();
    client.clear();
  });
});

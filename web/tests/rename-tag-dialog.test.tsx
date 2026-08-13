import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RenameTagDialog from "@/components/RenameTagDialog";
import { useRenameMemoTag } from "@/hooks/useMemoQueries";

const clients = vi.hoisted(() => ({
  renameMemoTag: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: {
    renameMemoTag: clients.renameMemoTag,
  },
  userServiceClient: {},
  shortcutServiceClient: {},
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const renderDialog = (queryClient: QueryClient, props?: Partial<Parameters<typeof RenameTagDialog>[0]>) =>
  render(<RenameTagDialog open onOpenChange={() => {}} tag="todo" usedCount={5} {...props} />, {
    wrapper: createWrapper(queryClient),
  });

describe("RenameTagDialog", () => {
  beforeEach(() => {
    clients.renameMemoTag.mockReset();
  });

  it("shows the current tag and affected memo count", () => {
    renderDialog(createQueryClient());

    expect(screen.getByText("#todo")).toBeInTheDocument();
    expect(screen.getByText("setting.tags.rename-description:" + '{"count":5}')).toBeInTheDocument();
  });

  it("disables submission for empty and unchanged names", () => {
    renderDialog(createQueryClient());

    const input = screen.getByLabelText("setting.tags.rename-new-tag") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "setting.tags.rename-submit" });

    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "todo" } });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "#done" } });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "done now" } });
    expect(submit).toBeDisabled();
  });

  it("submits the rename and reports the updated memo count on success", async () => {
    clients.renameMemoTag.mockResolvedValue({ updatedMemoCount: 7 });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    renderDialog(createQueryClient(), { onOpenChange, onSuccess });

    fireEvent.change(screen.getByLabelText("setting.tags.rename-new-tag"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.tags.rename-submit" }));

    await waitFor(() => expect(clients.renameMemoTag).toHaveBeenCalledTimes(1));
    expect(clients.renameMemoTag.mock.calls[0][0]).toMatchObject({ oldTag: "todo", newTag: "done" });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSuccess).toHaveBeenCalledWith(7);
  });

  it("keeps the dialog open for retry and surfaces the error on failure", async () => {
    clients.renameMemoTag.mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    renderDialog(createQueryClient(), { onOpenChange, onSuccess });

    fireEvent.change(screen.getByLabelText("setting.tags.rename-new-tag"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.tags.rename-submit" }));

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();

    // The input keeps its value so the user can retry.
    expect((screen.getByLabelText("setting.tags.rename-new-tag") as HTMLInputElement).value).toBe("done");

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("prevents duplicate submissions while the request is pending", async () => {
    let resolveRename: (value: { updatedMemoCount: number }) => void = () => {};
    clients.renameMemoTag.mockImplementation(
      () =>
        new Promise<{ updatedMemoCount: number }>((resolve) => {
          resolveRename = resolve;
        }),
    );
    renderDialog(createQueryClient());

    fireEvent.change(screen.getByLabelText("setting.tags.rename-new-tag"), { target: { value: "done" } });
    const submit = screen.getByRole("button", { name: "setting.tags.rename-submit" });
    fireEvent.click(submit);

    await waitFor(() => expect(clients.renameMemoTag).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "common.renaming" }));
    fireEvent.click(submit);
    expect(clients.renameMemoTag).toHaveBeenCalledTimes(1);

    resolveRename({ updatedMemoCount: 2 });
    // Once the request settles the pending label goes away. The submit button is
    // disabled again because the input was cleared on success.
    await waitFor(() => expect(screen.getByRole("button", { name: "setting.tags.rename-submit" })).toBeInTheDocument());
  });
});

describe("useRenameMemoTag", () => {
  beforeEach(() => {
    clients.renameMemoTag.mockReset();
  });

  it("invalidates memo and user stats queries after a successful rename", async () => {
    clients.renameMemoTag.mockResolvedValue({ updatedMemoCount: 3 });
    const queryClient = createQueryClient();
    // Seed a stale successful query so invalidation is observable.
    queryClient.setQueryData(["memos", "list"], { memos: [], nextPageToken: "" });
    queryClient.setQueryData(["users", "stats", "users/alice/stats"], { tagCount: {} });

    const wrapper = createWrapper(queryClient);
    const { result } = renderHook(() => useRenameMemoTag(), { wrapper });

    await result.current.mutateAsync({ oldTag: "todo", newTag: "done" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(["memos", "list"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["users", "stats", "users/alice/stats"])?.isInvalidated).toBe(true);
  });
});

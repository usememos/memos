import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoSave } from "@/components/MemoEditor/hooks/useMemoSave";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  markNewMemo: vi.fn(),
  memoSave: vi.fn(),
}));

vi.mock("@/components/MemoEditor/services", () => ({
  errorService: { getErrorMessage: () => "save failed" },
  memoService: { save: mocks.memoSave },
  validationService: { canSave: () => ({ valid: true }) },
}));

vi.mock("@/components/MemoEditor/state", () => ({
  useEditorContext: () => ({
    actions: {
      reset: () => ({ type: "reset" }),
      setLoading: (key: string, value: boolean) => ({ type: "set-loading", key, value }),
      setJustSaved: (value: boolean) => ({ type: "set-just-saved", value }),
      setMetadata: () => ({ type: "set-metadata" }),
      setTimestamps: () => ({ type: "set-timestamps" }),
    },
    dispatch: mocks.dispatch,
    getState: () => ({ ui: { justSaved: false } }),
  }),
}));

vi.mock("@/contexts/NewMemoContext", () => ({
  useNewMemo: () => ({ markNewMemo: mocks.markNewMemo }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("useMemoSave", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.markNewMemo.mockReset();
    mocks.memoSave.mockReset();
  });

  it("invalidates scoped attachment libraries after a memo save", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: true, memoName: "memos/new" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const discardDraft = vi.fn();
    const { result } = renderHook(() => useMemoSave({ discardDraft }), { wrapper });

    await act(async () => result.current());

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["attachments", "list"] });
    expect(discardDraft).toHaveBeenCalledOnce();
    expect(mocks.markNewMemo).toHaveBeenCalledWith("memos/new");
  });

  it("refreshes the parent memo total after creating a comment", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: true, memoName: "memos/comment" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useMemoSave({ parentMemoName: "memos/parent", discardDraft: vi.fn() }), { wrapper });

    await act(async () => result.current());

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["memos", "comments", "memos/parent"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["memos", "detail", "memos/parent"] });
  });

  it("holds a saved confirmation before a closing host resets", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: true, memoName: "memos/existing" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useMemoSave({ memoName: "memos/existing", discardDraft: vi.fn(), onConfirm }), { wrapper });

    await act(async () => result.current());

    const types = mocks.dispatch.mock.calls.map(([action]) => action);
    const savedOn = types.findIndex((a) => a.type === "set-just-saved" && a.value === true);
    const reset = types.findIndex((a) => a.type === "reset");
    expect(savedOn).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(savedOn);
    expect(onConfirm).toHaveBeenCalledWith("memos/existing");
  });

  it("does not hold the in-place composer after saving a new memo", async () => {
    mocks.memoSave.mockResolvedValue({ hasChanges: true, memoName: "memos/new" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useMemoSave({ discardDraft: vi.fn() }), { wrapper });

    await act(async () => result.current());

    const savedOn = mocks.dispatch.mock.calls.some(([action]) => action.type === "set-just-saved" && action.value === true);
    expect(savedOn).toBe(false);
  });
});

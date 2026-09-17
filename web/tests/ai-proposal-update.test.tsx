import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const api = vi.hoisted(() => ({ updateMemo: vi.fn() }));
vi.mock("@/connect", () => ({ memoServiceClient: api }));

describe("AI proposal memo update", () => {
  it("forwards the reviewed content snapshot as an update precondition", async () => {
    api.updateMemo.mockResolvedValue(create(MemoSchema, { name: "memos/target", content: "replacement" }));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useUpdateMemo(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        update: { name: "memos/target", content: "replacement" },
        updateMask: ["content"],
        expectedContent: "reviewed snapshot",
      }),
    );

    expect(api.updateMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedContent: "reviewed snapshot",
      }),
    );
    client.clear();
  });
});

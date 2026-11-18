import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listMemos: vi.fn(),
}));

vi.mock("@/connect", () => ({
  memoServiceClient: { listMemos: mocks.listMemos },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/alice" }),
}));

import { useLinkMemo } from "@/components/MemoEditor/edit/hooks/useLinkMemo";

const lastFilter = () => mocks.listMemos.mock.calls.at(-1)?.[0]?.filter;

describe("useLinkMemo search filter", () => {
  beforeEach(() => {
    mocks.listMemos.mockResolvedValue({ memos: [] });
  });

  it.each([
    ["meeting", 'creator == "users/alice" && content.contains("meeting")'],
    ['say "hi"', 'creator == "users/alice" && content.contains("say \\"hi\\"")'],
    ["C:\\", 'creator == "users/alice" && content.contains("C:\\\\")'],
  ])("passes %j to the filter as a quoted CEL string", async (searchText, expected) => {
    const { result } = renderHook(() => useLinkMemo({ isOpen: true, existingRelations: [], onAddRelation: vi.fn() }));

    act(() => {
      result.current.setSearchText(searchText);
    });

    await waitFor(() => expect(lastFilter()).toBe(expected));
  });
});

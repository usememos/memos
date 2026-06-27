import { describe, expect, it } from "vitest";
import { hoistMemoToFront } from "@/hooks/useMemoSorting";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

const memo = (name: string) => ({ name }) as Memo;

describe("hoistMemoToFront", () => {
  it("moves the named memo to the front, above everything else", () => {
    const list = [memo("memos/pin1"), memo("memos/pin2"), memo("memos/new")];
    expect(hoistMemoToFront(list, "memos/new").map((m) => m.name)).toEqual(["memos/new", "memos/pin1", "memos/pin2"]);
  });

  it("returns the list unchanged when the name is null", () => {
    const list = [memo("memos/a"), memo("memos/b")];
    expect(hoistMemoToFront(list, null)).toBe(list);
  });

  it("returns the list unchanged when the name is absent", () => {
    const list = [memo("memos/a"), memo("memos/b")];
    expect(hoistMemoToFront(list, "memos/missing")).toBe(list);
  });

  it("returns the list unchanged when the memo is already first", () => {
    const list = [memo("memos/a"), memo("memos/b")];
    expect(hoistMemoToFront(list, "memos/a")).toBe(list);
  });

  it("does not mutate the input list", () => {
    const list = [memo("memos/a"), memo("memos/new")];
    hoistMemoToFront(list, "memos/new");
    expect(list.map((m) => m.name)).toEqual(["memos/a", "memos/new"]);
  });
});

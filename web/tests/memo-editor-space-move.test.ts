import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoService } from "@/components/MemoEditor/services/memoService";
import { createInitialState, type EditorState } from "@/components/MemoEditor/state";
import { type Memo, MemoSchema, Visibility } from "@/types/proto/api/memo_service_pb";

const clients = vi.hoisted(() => ({
  getMemo: vi.fn(),
  updateMemo: vi.fn(),
}));

vi.mock("@/connect", () => ({
  attachmentServiceClient: { createAttachment: vi.fn() },
  memoServiceClient: { getMemo: clients.getMemo, updateMemo: clients.updateMemo },
}));

const stored = (fields: Partial<Memo> = {}) =>
  create(MemoSchema, { name: "memos/1", content: "Same", visibility: Visibility.PRIVATE, ...fields } as Parameters<typeof create>[1]);

const editedFrom = (memo: Memo, metadata: Partial<EditorState["metadata"]>): EditorState => {
  const state = createInitialState();
  const initial = memoService.fromMemo(memo);
  return { ...state, ...initial, metadata: { ...state.metadata, ...initial.metadata, ...metadata } };
};

const savedMask = () => clients.updateMemo.mock.calls[0][0].updateMask.paths as string[];
const savedMemo = () => clients.updateMemo.mock.calls[0][0].memo as Memo;

describe("editing a memo's Space", () => {
  beforeEach(() => {
    clients.getMemo.mockReset();
    clients.updateMemo.mockReset();
    clients.updateMemo.mockImplementation(async ({ memo }: { memo: Memo }) => memo);
  });

  it("loads the memo's Space into the editor", () => {
    expect(memoService.fromMemo(stored({ space: "spaces/work" })).metadata.space).toBe("spaces/work");
    expect(memoService.fromMemo(stored()).metadata.space).toBeUndefined();
  });

  it("sends placement and audience together when the Space changes, and reports the move", async () => {
    const memo = stored({ space: "spaces/work", visibility: Visibility.SPACE });
    clients.getMemo.mockResolvedValue(memo);

    const result = await memoService.save(editedFrom(memo, { space: "spaces/reading" }), { memoName: memo.name });

    expect(new Set(savedMask())).toEqual(new Set(["space", "visibility"]));
    expect(savedMemo().space).toBe("spaces/reading");
    expect(savedMemo().visibility).toBe(Visibility.SPACE);
    expect(result).toMatchObject({ hasChanges: true, moved: true });
  });

  it("clears the Space with an empty name when the memo leaves it", async () => {
    const memo = stored({ space: "spaces/work" });
    clients.getMemo.mockResolvedValue(memo);

    await memoService.save(editedFrom(memo, { space: undefined }), { memoName: memo.name });

    expect(savedMask()).toContain("space");
    expect(savedMemo().space).toBe("");
  });

  it("leaves placement out of the update when the Space is unchanged", async () => {
    const memo = stored({ space: "spaces/work" });
    clients.getMemo.mockResolvedValue(memo);

    const result = await memoService.save({ ...editedFrom(memo, {}), content: "Edited" }, { memoName: memo.name });

    expect(savedMask()).not.toContain("space");
    expect(result.moved).toBe(false);
  });
});

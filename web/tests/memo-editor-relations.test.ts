import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoService } from "@/components/MemoEditor/services/memoService";
import { createInitialState, type EditorState } from "@/components/MemoEditor/state";
import {
  type Memo,
  MemoRelation_MemoSchema,
  MemoRelation_Type,
  MemoRelationSchema,
  MemoSchema,
} from "@/types/proto/api/v1/memo_service_pb";

const clients = vi.hoisted(() => ({
  createMemo: vi.fn(),
  createMemoComment: vi.fn(),
  getMemo: vi.fn(),
  updateMemo: vi.fn(),
}));

vi.mock("@/connect", () => ({
  attachmentServiceClient: {
    createAttachment: vi.fn(),
  },
  memoServiceClient: {
    createMemo: clients.createMemo,
    createMemoComment: clients.createMemoComment,
    getMemo: clients.getMemo,
    updateMemo: clients.updateMemo,
  },
}));

const createRelation = (type: MemoRelation_Type, memoName: string, relatedMemoName: string) =>
  create(MemoRelationSchema, {
    type,
    memo: create(MemoRelation_MemoSchema, { name: memoName }),
    relatedMemo: create(MemoRelation_MemoSchema, { name: relatedMemoName }),
  });

const createEditorState = (memo: Memo): EditorState => ({
  ...createInitialState(),
  ...memoService.fromMemo(memo),
});

describe("memo editor relations", () => {
  beforeEach(() => {
    clients.createMemo.mockReset().mockImplementation(async ({ memo }: { memo: Memo }) => ({ ...memo, name: "memos/created" }));
    clients.createMemoComment
      .mockReset()
      .mockImplementation(async ({ comment }: { comment: Memo }) => ({ ...comment, name: "memos/comment" }));
    clients.getMemo.mockReset();
    clients.updateMemo.mockReset();
    clients.updateMemo.mockImplementation(async ({ memo }: { memo: Memo }) => memo);
  });

  it("assigns a new top-level memo to the selected Space", async () => {
    const state = createInitialState();
    state.content = "Roadmap";

    await memoService.save(state, { space: "spaces/product" });

    expect(clients.createMemo).toHaveBeenCalledWith({
      memo: expect.objectContaining({ content: "Roadmap", space: "spaces/product" }),
    });
  });

  it("does not inherit the selected Space when creating a comment", async () => {
    const state = createInitialState();
    state.content = "Reply";

    await memoService.save(state, { parentMemoName: "memos/parent", space: "spaces/product" });

    expect(clients.createMemoComment).toHaveBeenCalledOnce();
    const request = clients.createMemoComment.mock.calls[0][0];
    expect(request.name).toBe("memos/parent");
    expect(request.comment.content).toBe("Reply");
    expect(request.comment.space).toBeUndefined();
  });

  it("never sends relations: the server derives them from the content", async () => {
    const memoName = "memos/subject";
    const existingReference = createRelation(MemoRelation_Type.REFERENCE, memoName, "memos/existing-reference");
    const memo = create(MemoSchema, { name: memoName, content: "Subject", relations: [existingReference] });
    const state = createEditorState(memo);
    state.content = "Subject, now referencing [Memos](/memos/added-reference)";
    clients.getMemo.mockResolvedValue(memo);

    await memoService.save(state, { memoName });

    expect(clients.updateMemo).toHaveBeenCalledOnce();
    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toContain("content");
    expect(request.updateMask.paths).not.toContain("relations");
    expect(request.memo.relations).toEqual([]);
  });

  it("does not send relations when creating a memo that references another", async () => {
    const state = createInitialState();
    state.content = "See [Memos](/memos/target)";

    await memoService.save(state, {});

    const { memo } = clients.createMemo.mock.calls[0][0];
    expect(memo.content).toBe("See [Memos](/memos/target)");
    expect(memo.relations).toEqual([]);
  });

  it("reports no changes when only the memo's relations moved", async () => {
    const parentName = "memos/parent";
    const outgoingReference = createRelation(MemoRelation_Type.REFERENCE, parentName, "memos/reference");
    const editorMemo = create(MemoSchema, {
      name: parentName,
      content: "Parent",
      relations: [outgoingReference],
    });
    const freshMemo = create(MemoSchema, {
      name: parentName,
      content: editorMemo.content,
      relations: [outgoingReference, createRelation(MemoRelation_Type.COMMENT, "memos/new-comment", parentName)],
    });
    const state = createEditorState(editorMemo);
    clients.getMemo.mockResolvedValue(freshMemo);

    const result = await memoService.save(state, { memoName: parentName });

    expect(result).toEqual({ memoName: parentName, hasChanges: false });
    expect(clients.updateMemo).not.toHaveBeenCalled();
  });
});

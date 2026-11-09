import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoService } from "@/components/MemoEditor/services/memoService";
import { createInitialState } from "@/components/MemoEditor/state";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const clients = vi.hoisted(() => ({ createMemo: vi.fn(), getMemo: vi.fn(), updateMemo: vi.fn() }));

vi.mock("@/connect", () => ({
  attachmentServiceClient: { createAttachment: vi.fn() },
  memoServiceClient: clients,
}));

const original = new Date(2027, 0, 2, 9, 30);
const changed = new Date(2027, 0, 3, 10, 45);

const createMemo = (hideUntil?: Date) =>
  create(MemoSchema, {
    name: "memos/hide-until",
    content: "Reminder",
    hideUntil: hideUntil ? timestampFromDate(hideUntil) : undefined,
  });

describe("memo editor hide until persistence", () => {
  beforeEach(() => {
    clients.createMemo.mockReset().mockImplementation(async ({ memo }: { memo: Memo }) => ({ ...memo, name: "memos/created" }));
    clients.getMemo.mockReset();
    clients.updateMemo.mockReset().mockImplementation(async ({ memo }: { memo: Memo }) => memo);
  });

  it("sends hideUntil when creating a memo", async () => {
    const state = createInitialState();
    state.content = "Reminder";
    state.metadata.hideUntil = original;

    await memoService.save(state, {});

    expect(clients.createMemo).toHaveBeenCalledWith({
      memo: expect.objectContaining({ hideUntil: timestampFromDate(original) }),
    });
  });

  it("hydrates and updates hideUntil with the API field mask", async () => {
    const memo = createMemo(original);
    const state = { ...createInitialState(), ...memoService.fromMemo(memo) };
    state.metadata.hideUntil = changed;
    clients.getMemo.mockResolvedValue(memo);

    await memoService.save(state, { memoName: memo.name });

    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual(["hide_until", "update_time"]);
    expect(request.memo.hideUntil).toEqual(timestampFromDate(changed));
  });

  it("clears an existing hideUntil value", async () => {
    const memo = createMemo(original);
    const state = { ...createInitialState(), ...memoService.fromMemo(memo) };
    state.metadata.hideUntil = undefined;
    clients.getMemo.mockResolvedValue(memo);

    await memoService.save(state, { memoName: memo.name });

    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual(["hide_until", "update_time"]);
    expect(request.memo.hideUntil).toBeUndefined();
  });
});

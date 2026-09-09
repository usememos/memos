import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimestampPopover } from "@/components/MemoEditor/components/TimestampPopover";
import { memoService } from "@/components/MemoEditor/services/memoService";
import { createInitialState, EditorProvider, useEditorContext } from "@/components/MemoEditor/state";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const clients = vi.hoisted(() => ({ getMemo: vi.fn(), updateMemo: vi.fn() }));
vi.mock("@/connect", () => ({
  attachmentServiceClient: { createAttachment: vi.fn() },
  memoServiceClient: clients,
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const originalCreate = new Date(2020, 0, 1, 10, 20, 30);
const originalUpdate = new Date(2020, 0, 2, 11, 22, 33);
const customTime = new Date(2024, 1, 29, 12, 34, 56);
let editor: ReturnType<typeof useEditorContext>;

function Probe() {
  editor = useEditorContext();
  return <TimestampPopover />;
}

function renderEditor() {
  const memo = create(MemoSchema, {
    name: "memos/timestamps",
    content: "Original content",
    createTime: timestampFromDate(originalCreate),
    updateTime: timestampFromDate(originalUpdate),
  });
  clients.getMemo.mockResolvedValue(memo);
  render(
    <EditorProvider initialEditorState={{ ...createInitialState(), ...memoService.fromMemo(memo) }}>
      <Probe />
    </EditorProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  return memo;
}

describe("memo editor timestamps", () => {
  beforeEach(() => {
    clients.updateMemo.mockImplementation(async ({ memo }: { memo: Memo }) => memo);
  });

  it.each([
    [0, "createTime", "create_time"],
    [1, "updateTime", "update_time"],
  ] as const)("saves %s after dismissing the focused input with Escape", async (index, field, path) => {
    const memo = renderEditor();
    const input = screen.getAllByRole("textbox")[index];
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "2024-02-29 12:34:56" } });
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());

    await memoService.save(editor.getState(), { memoName: memo.name });

    expect(clients.updateMemo).toHaveBeenCalledOnce();
    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual([path]);
    expect(request.memo[field]).toEqual(timestampFromDate(customTime));
  });

  it.each([
    "2024-02-30 12:34:56",
    "2024-13-01 12:34:56",
    "2024-02-29 24:34:56",
    "invalid",
  ])("rejects invalid local time %s without changing the saved timestamp", async (value) => {
    const memo = renderEditor();
    const input = screen.getAllByRole("textbox")[0];
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("data-invalid", "true");
    expect(editor.getState().timestamps.createTime).toEqual(originalCreate);
    await memoService.save(editor.getState(), { memoName: memo.name });
    expect(clients.updateMemo).not.toHaveBeenCalled();
  });

  it("automatically updates the modification time for content edits", async () => {
    const memo = renderEditor();
    const state = { ...editor.getState(), content: "Changed content" };
    await memoService.save(state, { memoName: memo.name });
    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual(["content", "update_time"]);
    expect(request.memo.updateTime).toBeUndefined();
    expect(request.memo.createTime).toBeUndefined();
  });

  it("keeps the explicitly chosen modification time when content also changes", async () => {
    const memo = renderEditor();
    const input = screen.getAllByRole("textbox")[1];
    fireEvent.change(input, { target: { value: "2024-02-29 12:34:56" } });
    // Saving must see the edit even if the input has not blurred yet.
    await memoService.save({ ...editor.getState(), content: "Changed content" }, { memoName: memo.name });
    const request = clients.updateMemo.mock.calls[0][0];
    expect(request.updateMask.paths).toEqual(["content", "update_time"]);
    expect(request.memo.updateTime).toEqual(timestampFromDate(customTime));
  });
});

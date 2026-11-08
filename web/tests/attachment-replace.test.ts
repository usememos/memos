import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const mocks = vi.hoisted(() => ({ uploadAttachment: vi.fn() }));

vi.mock("@/connect", () => ({
  attachmentServiceClient: { uploadAttachment: mocks.uploadAttachment },
}));

import {
  DrawingNotSavedError,
  type MemoSaveOperations,
  memoService,
  mergeUploadedAttachments,
} from "@/components/MemoEditor/edit/services/memoService";
import { uploadService } from "@/components/MemoEditor/edit/services/uploadService";
import { createInitialState } from "@/components/MemoEditor/edit/state/types";
import { type Memo, MemoSchema } from "@/types/proto/api/memo_service_pb";

const attachment = (name: string, filename = `${name}.png`) => create(AttachmentSchema, { name, filename, type: "image/png" });

describe("replacing an attachment's content", () => {
  it("uploads an edit over the attachment it replaces", async () => {
    const replaced = attachment("attachments/drawing", "drawing-2.canvas.png");
    mocks.uploadAttachment
      .mockResolvedValueOnce({ uploadId: "u1", committedSize: 0n, maxChunkSize: 1024 })
      .mockResolvedValueOnce({ uploadId: "u1", committedSize: 4n, attachment: replaced });
    const edit: LocalFile = {
      file: new File(["edit"], "drawing-2.canvas.png", { type: "image/png" }),
      previewUrl: "blob:edit",
      replaces: "attachments/drawing",
    };

    await expect(uploadService.uploadFile(edit)).resolves.toBe(replaced);

    const [request] = mocks.uploadAttachment.mock.calls[0];
    expect(request.upload.case).toBe("spec");
    expect(request.upload.value.replaceAttachment).toBe("attachments/drawing");
  });

  it("starts a new attachment when nothing is replaced", async () => {
    mocks.uploadAttachment
      .mockResolvedValueOnce({ uploadId: "u2", committedSize: 0n, maxChunkSize: 1024 })
      .mockResolvedValueOnce({ uploadId: "u2", committedSize: 5n, attachment: attachment("attachments/new") });

    await uploadService.uploadFile({ file: new File(["photo"], "photo.png", { type: "image/png" }), previewUrl: "blob:photo" });

    expect(mocks.uploadAttachment.mock.calls[0][0].upload.value.replaceAttachment).toBe("");
  });

  it("puts a replaced attachment back in its place and appends new ones", () => {
    const first = attachment("attachments/first");
    const drawing = attachment("attachments/drawing", "drawing-1.canvas.png");
    const last = attachment("attachments/last");
    const edited = attachment("attachments/drawing", "drawing-2.canvas.png");
    const added = attachment("attachments/added");

    expect(mergeUploadedAttachments([first, drawing, last], [edited, added])).toEqual([first, edited, last, added]);
  });

  describe("saving a memo with an edited drawing", () => {
    const saved = attachment("attachments/drawing", "drawing-1.canvas.png");
    const edited = attachment("attachments/drawing", "drawing-2.canvas.png");
    const memo = create(MemoSchema, {
      name: "memos/m",
      content: "hello",
      visibility: createInitialState().metadata.visibility,
      attachments: [saved],
    });
    const edit: LocalFile = {
      file: new File(["edit"], "drawing-2.canvas.png", { type: "image/png" }),
      previewUrl: "blob:edit",
      replaces: saved.name,
    };
    const draft = (content: string) => {
      const state = createInitialState();
      return { ...state, content, localFiles: [edit], metadata: { ...state.metadata, attachments: [saved] } };
    };
    const order: string[] = [];
    const operations = (updateMemo: MemoSaveOperations["updateMemo"]): MemoSaveOperations => ({
      getMemo: vi.fn(async () => memo),
      updateMemo: vi.fn(async (update, mask) => {
        order.push(`update ${mask.join(",")}`);
        return updateMemo(update, mask);
      }),
      createMemo: vi.fn(async (data: Memo) => {
        order.push("create");
        return create(MemoSchema, { ...data, name: "memos/new" });
      }),
    });
    const mockReplacementUpload = () =>
      mocks.uploadAttachment.mockImplementation(async (request) => {
        if (request.upload.case === "spec") {
          order.push(`upload over ${request.upload.value.replaceAttachment}`);
          return { uploadId: "u", committedSize: 0n, maxChunkSize: 1024 };
        }
        return { uploadId: "u", committedSize: 4n, attachment: edited };
      });

    beforeEach(() => {
      order.length = 0;
      mocks.uploadAttachment.mockReset();
    });

    it("replaces the drawing only after the memo itself is saved", async () => {
      mockReplacementUpload();
      const ops = operations(async () => create(MemoSchema, { ...memo, content: "changed", attachments: [edited] }));

      const result = await memoService.save(draft("changed"), { memoName: memo.name }, ops);

      expect(order).toEqual(["update content,update_time", `upload over ${saved.name}`, "update update_time"]);
      expect(result.hasChanges).toBe(true);
      // The refresh sends no attachment list, so an attachment added elsewhere meanwhile stays.
      const [refresh] = vi.mocked(ops.updateMemo).mock.calls[1];
      expect(refresh.attachments).toBeUndefined();
    });

    it("leaves the saved drawing untouched when the memo save is refused", async () => {
      mockReplacementUpload();
      const ops = operations(async () => {
        throw new Error("permission denied");
      });

      await expect(memoService.save(draft("changed"), { memoName: memo.name }, ops)).rejects.toThrow("permission denied");

      expect(order).toEqual(["update content,update_time"]);
      expect(mocks.uploadAttachment).not.toHaveBeenCalled();
    });

    it("saves a drawing edit on its own", async () => {
      mockReplacementUpload();
      const ops = operations(async () => create(MemoSchema, { ...memo, attachments: [edited] }));

      const result = await memoService.save(draft("hello"), { memoName: memo.name }, ops);

      expect(order).toEqual([`upload over ${saved.name}`, "update update_time"]);
      expect(result.hasChanges).toBe(true);
    });

    it("reports a drawing that failed after the rest of the memo saved", async () => {
      mocks.uploadAttachment.mockRejectedValue(new Error("offline"));
      const ops = operations(async () => create(MemoSchema, { ...memo, content: "changed" }));

      await expect(memoService.save(draft("changed"), { memoName: memo.name }, ops)).rejects.toBeInstanceOf(DrawingNotSavedError);
      expect(order).toEqual(["update content,update_time"]);
    });

    it("reports a plain failure when the drawing was the only change", async () => {
      mocks.uploadAttachment.mockRejectedValue(new Error("offline"));
      const ops = operations(async () => memo);

      const saving = memoService.save(draft("hello"), { memoName: memo.name }, ops);
      await expect(saving).rejects.toThrow("offline");
      await expect(saving).rejects.not.toBeInstanceOf(DrawingNotSavedError);
    });

    it("replaces before creating a new memo, so a failed replacement creates nothing", async () => {
      mocks.uploadAttachment.mockRejectedValue(new Error("offline"));
      const ops = operations(async () => memo);

      await expect(memoService.save(draft("hello"), {}, ops)).rejects.toThrow("offline");

      expect(ops.createMemo).not.toHaveBeenCalled();
    });
  });
});

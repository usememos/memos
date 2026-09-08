import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const { uploadAttachment } = vi.hoisted(() => ({ uploadAttachment: vi.fn() }));
vi.mock("@/connect", () => ({ attachmentServiceClient: { uploadAttachment } }));

import { uploadService } from "@/components/MemoEditor/services/uploadService";

const attachment = create(AttachmentSchema, { name: "attachments/uploaded" });
const localFile = (content: string) => ({
  file: new File([content], "test.txt", { type: "text/plain" }),
  origin: "upload" as const,
  previewUrl: "blob:test",
});

describe("chunked attachment uploads", () => {
  beforeEach(() => {
    uploadAttachment.mockImplementation(async (request) => ({
      uploadId: "opaque-id",
      maxChunkSize: 3,
      committedSize: request.data ? request.writeOffset + BigInt(request.data.length) : 0n,
      attachment: request.finishWrite ? attachment : undefined,
    }));
  });

  it("reads only file slices and writes consecutive offsets", async () => {
    const local = localFile("abcdefgh");
    const wholeFileRead = vi.spyOn(local.file, "arrayBuffer").mockRejectedValue(new Error("must not read the whole file"));
    const slice = vi.spyOn(local.file, "slice");

    await expect(uploadService.uploadFile(local)).resolves.toEqual(attachment);

    expect(wholeFileRead).not.toHaveBeenCalled();
    expect(slice.mock.calls).toEqual([
      [0, 3],
      [3, 6],
      [6, 8],
    ]);
    const requests = uploadAttachment.mock.calls.map(([request]) => request);
    expect(requests[0].upload.case).toBe("spec");
    expect(requests[0].upload.value.totalSize).toBe(8n);
    expect(requests[0].upload.value.attachment.content).toHaveLength(0);
    expect(requests[0].data).toBeUndefined();
    expect(requests.slice(1).map((request) => request.upload)).toEqual(Array(3).fill({ case: "uploadId", value: "opaque-id" }));
    expect(requests.slice(1).map((request) => request.writeOffset)).toEqual([0n, 3n, 6n]);
    expect(requests.slice(1).map((request) => new TextDecoder().decode(request.data))).toEqual(["abc", "def", "gh"]);
    expect(requests.slice(1).map((request) => request.finishWrite)).toEqual([false, false, true]);
  });

  it("finalizes an empty file", async () => {
    await expect(uploadService.uploadFile(localFile(""))).resolves.toEqual(attachment);
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
    expect(uploadAttachment.mock.calls[1][0]).toMatchObject({ writeOffset: 0n, finishWrite: true });
    expect(uploadAttachment.mock.calls[1][0].data).toHaveLength(0);
  });

  it("retries an identical final chunk after a lost response", async () => {
    const original = uploadAttachment.getMockImplementation();
    let lost = false;
    uploadAttachment.mockImplementation(async (request) => {
      if (request.finishWrite && !lost) {
        lost = true;
        throw new ConnectError("response lost", Code.Unavailable);
      }
      return original?.(request);
    });

    await expect(uploadService.uploadFile(localFile("abc"))).resolves.toEqual(attachment);
    expect(uploadAttachment.mock.calls[1][0]).toBe(uploadAttachment.mock.calls[2][0]);
  });

  it("does not retry permission errors", async () => {
    uploadAttachment.mockRejectedValueOnce(new ConnectError("denied", Code.PermissionDenied));
    await expect(uploadService.uploadFile(localFile("abc"))).rejects.toMatchObject({ code: Code.PermissionDenied });
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
  });

  it("bounds retries and stops on cancellation", async () => {
    const initial = { uploadId: "id", committedSize: 0n, maxChunkSize: 3 };
    uploadAttachment.mockResolvedValueOnce(initial).mockRejectedValue(new ConnectError("offline", Code.Unavailable));
    await expect(uploadService.uploadFile(localFile("abc"))).rejects.toMatchObject({ code: Code.Unavailable });
    expect(uploadAttachment).toHaveBeenCalledTimes(4);

    uploadAttachment.mockReset().mockResolvedValue(initial);
    const controller = new AbortController();
    controller.abort();
    await expect(uploadService.uploadFile(localFile("abc"), controller.signal)).rejects.toThrow();
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid progress instead of looping or skipping bytes", async () => {
    uploadAttachment.mockResolvedValue({ uploadId: "id", committedSize: 0n, maxChunkSize: 3 });
    await expect(uploadService.uploadFile(localFile("abcdef"))).rejects.toThrow("Unexpected upload offset");
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
  });
});

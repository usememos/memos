import { create } from "@bufbuild/protobuf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalFile } from "@/components/MemoEditor/types/attachment";
import { MediaMetadataSchema } from "@/types/proto/api/v1/attachment_service_pb";

const mocks = vi.hoisted(() => ({
  createAttachment: vi.fn(),
  extractMetadata: vi.fn(),
}));

// The ingest helper lives beside useFileUpload, whose module graph reaches
// AuthContext and the query hooks; stub every client they name-import.
vi.mock("@/connect", () => ({
  attachmentServiceClient: { createAttachment: mocks.createAttachment },
  authServiceClient: {},
  userServiceClient: {},
  memoViewServiceClient: {},
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/components/MemoEditor/services/mediaMetadataService", () => ({
  mediaMetadataService: { extract: mocks.extractMetadata },
}));

import { toLocalFiles } from "@/components/MemoEditor/hooks/useFileUpload";
import { uploadService } from "@/components/MemoEditor/services/uploadService";

const createBlobUrl = (file: File) => `blob:${file.name}`;

const localImage = (mediaMetadata?: LocalFile["mediaMetadata"]): LocalFile => ({
  file: new File(["image"], "photo.png", { type: "image/png" }),
  previewUrl: "blob:photo",
  origin: "upload",
  mediaMetadata,
});

describe("media metadata at file ingest", () => {
  it("does not extract metadata when the setting is disabled", () => {
    const file = new File(["image"], "photo.png", { type: "image/png" });

    const [localFile] = toLocalFiles([file], { createBlobUrl, saveMediaMetadata: false });

    expect(mocks.extractMetadata).not.toHaveBeenCalled();
    expect(localFile.mediaMetadata).toBeUndefined();
  });

  it("starts extraction per file when the setting is enabled", async () => {
    const metadata = create(MediaMetadataSchema, { width: 1200, height: 800 });
    mocks.extractMetadata.mockResolvedValue(metadata);
    const file = new File(["image"], "photo.png", { type: "image/png" });

    const [localFile] = toLocalFiles([file], { createBlobUrl, saveMediaMetadata: true });

    expect(mocks.extractMetadata).toHaveBeenCalledWith(file);
    await expect(localFile.mediaMetadata).resolves.toEqual(metadata);
  });
});

describe("uploadService media metadata", () => {
  beforeEach(() => {
    mocks.createAttachment.mockImplementation(async ({ attachment }) => attachment);
  });

  it("submits no metadata for files ingested without any", async () => {
    await uploadService.uploadFiles([localImage()]);

    expect(mocks.createAttachment).toHaveBeenCalledOnce();
    expect(mocks.createAttachment.mock.calls[0][0].attachment.mediaMetadata).toBeUndefined();
  });

  it("submits the metadata extracted at ingest", async () => {
    const metadata = create(MediaMetadataSchema, { width: 1200, height: 800 });

    await uploadService.uploadFiles([localImage(Promise.resolve(metadata))]);

    expect(mocks.createAttachment.mock.calls[0][0].attachment.mediaMetadata).toEqual(metadata);
  });

  it("continues without metadata when extraction produced no usable values", async () => {
    await uploadService.uploadFiles([localImage(Promise.resolve(undefined))]);

    expect(mocks.createAttachment).toHaveBeenCalledOnce();
    expect(mocks.createAttachment.mock.calls[0][0].attachment.mediaMetadata).toBeUndefined();
  });

  it("submits ingest-time metadata end to end", async () => {
    const metadata = create(MediaMetadataSchema, { width: 640, height: 480 });
    mocks.extractMetadata.mockResolvedValue(metadata);
    const file = new File(["image"], "photo.png", { type: "image/png" });

    await uploadService.uploadFiles(toLocalFiles([file], { createBlobUrl, saveMediaMetadata: true }));

    expect(mocks.createAttachment.mock.calls[0][0].attachment.mediaMetadata).toEqual(metadata);
  });
});

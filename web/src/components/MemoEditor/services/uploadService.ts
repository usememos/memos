import { create, fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { authenticatedFetch } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema, CreateAttachmentRequestSchema, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";
import type { LocalFile } from "../types/attachment";

export const uploadService = {
  async uploadFile(localFile: LocalFile, signal?: AbortSignal): Promise<Attachment> {
    const { file, motionMedia } = localFile;
    const mediaMetadata = await localFile.mediaMetadata;
    const metadata = create(CreateAttachmentRequestSchema, {
      attachment: create(AttachmentSchema, {
        filename: file.name,
        size: BigInt(file.size),
        type: file.type,
        motionMedia: motionMedia ? create(MotionMediaSchema, motionMedia) : undefined,
        mediaMetadata,
      }),
    });
    const body = new FormData();
    body.append("metadata", toJsonString(CreateAttachmentRequestSchema, metadata));
    body.append("file", file);
    const response = await authenticatedFetch("/api/v1/attachments:upload", { method: "POST", body, signal });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ConnectError(
        error?.message || `Upload failed (${response.status})`,
        error?.code || (response.status === 413 ? Code.ResourceExhausted : Code.Unknown),
      );
    }
    return fromJsonString(AttachmentSchema, await response.text());
  },

  async uploadFiles(localFiles: LocalFile[]): Promise<Attachment[]> {
    if (localFiles.length === 0) return [];

    const attachments: Attachment[] = [];

    for (const localFile of localFiles) {
      attachments.push(await uploadService.uploadFile(localFile));
    }

    return attachments;
  },
};

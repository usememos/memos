import { create } from "@bufbuild/protobuf";
import { attachmentServiceClient } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import type { LocalFile } from "../types/attachment";

export const uploadService = {
  async uploadFiles(localFiles: LocalFile[]): Promise<Attachment[]> {
    if (localFiles.length === 0) return [];

    const attachments: Attachment[] = [];

    for (const { file } of localFiles) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const attachment = await attachmentServiceClient.createAttachment({
        attachment: create(AttachmentSchema, {
          filename: file.name,
          size: BigInt(file.size),
          type: file.type,
          content: buffer,
        }),
      });
      attachments.push(attachment);
    }

    return attachments;
  },
};

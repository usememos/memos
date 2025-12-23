import { create } from "@bufbuild/protobuf";
import type { LocalFile } from "@/components/memo-metadata";
import { attachmentStore } from "@/store";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { EditorError } from "./errorService";

export const uploadService = {
  async uploadFiles(localFiles: LocalFile[]): Promise<Attachment[]> {
    if (localFiles.length === 0) return [];

    try {
      const attachments: Attachment[] = [];

      for (const { file } of localFiles) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const attachment = await attachmentStore.createAttachment(
          create(AttachmentSchema, {
            filename: file.name,
            size: BigInt(file.size),
            type: file.type,
            content: buffer,
          }),
        );
        attachments.push(attachment);
      }

      return attachments;
    } catch (error) {
      throw new EditorError("UPLOAD_FAILED", error);
    }
  },
};

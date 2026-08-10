import { create } from "@bufbuild/protobuf";
import { attachmentServiceClient } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema, MotionMediaSchema } from "@/types/proto/api/v1/attachment_service_pb";
import type { LocalFile } from "../types/attachment";

export const uploadService = {
  async uploadFile(localFile: LocalFile): Promise<Attachment> {
    const { file, motionMedia } = localFile;
    const buffer = new Uint8Array(await file.arrayBuffer());
    return attachmentServiceClient.createAttachment({
      attachment: create(AttachmentSchema, {
        filename: file.name,
        size: BigInt(file.size),
        type: file.type,
        content: buffer,
        motionMedia: motionMedia ? create(MotionMediaSchema, motionMedia) : undefined,
      }),
    });
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

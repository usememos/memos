import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentType } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";

export interface AttachmentGroups {
  visual: Attachment[];
  audio: Attachment[];
  docs: Attachment[];
}

export interface AttachmentMetadata {
  fileTypeLabel: string;
  fileSizeLabel?: string;
}

export const isImageAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "image/*";
export const isVideoAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "video/*";
export const isAudioAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "audio/*";

export const separateAttachments = (attachments: Attachment[]): AttachmentGroups => {
  const groups: AttachmentGroups = {
    visual: [],
    audio: [],
    docs: [],
  };

  for (const attachment of attachments) {
    if (isImageAttachment(attachment) || isVideoAttachment(attachment)) {
      groups.visual.push(attachment);
      continue;
    }

    if (isAudioAttachment(attachment)) {
      groups.audio.push(attachment);
      continue;
    }

    groups.docs.push(attachment);
  }

  return groups;
};

export const getAttachmentMetadata = (attachment: Attachment): AttachmentMetadata => ({
  fileTypeLabel: getFileTypeLabel(attachment.type),
  fileSizeLabel: attachment.size ? formatFileSize(Number(attachment.size)) : undefined,
});

export const formatAudioTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

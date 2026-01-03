import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";

export type FileCategory = "image" | "video" | "document";

// Unified view model for rendering attachments and local files
export interface AttachmentItem {
  readonly id: string;
  readonly filename: string;
  readonly category: FileCategory;
  readonly mimeType: string;
  readonly thumbnailUrl: string;
  readonly sourceUrl: string;
  readonly size?: number;
  readonly isLocal: boolean;
}

// For MemoEditor: local files being uploaded
export interface LocalFile {
  readonly file: File;
  readonly previewUrl: string;
}

function categorizeFile(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

export function attachmentToItem(attachment: Attachment): AttachmentItem {
  const attachmentType = getAttachmentType(attachment);
  const sourceUrl = getAttachmentUrl(attachment);

  return {
    id: attachment.name,
    filename: attachment.filename,
    category: categorizeFile(attachment.type),
    mimeType: attachment.type,
    thumbnailUrl: attachmentType === "image/*" ? getAttachmentThumbnailUrl(attachment) : sourceUrl,
    sourceUrl,
    size: Number(attachment.size),
    isLocal: false,
  };
}

export function fileToItem(file: File, blobUrl: string): AttachmentItem {
  return {
    id: blobUrl,
    filename: file.name,
    category: categorizeFile(file.type),
    mimeType: file.type,
    thumbnailUrl: blobUrl,
    sourceUrl: blobUrl,
    size: file.size,
    isLocal: true,
  };
}

export function toAttachmentItems(attachments: Attachment[], localFiles: LocalFile[] = []): AttachmentItem[] {
  return [...attachments.map(attachmentToItem), ...localFiles.map(({ file, previewUrl }) => fileToItem(file, previewUrl))];
}

export function filterByCategory(items: AttachmentItem[], categories: FileCategory[]): AttachmentItem[] {
  const categorySet = new Set(categories);
  return items.filter((item) => categorySet.has(item.category));
}

export function separateMediaAndDocs(items: AttachmentItem[]): { media: AttachmentItem[]; docs: AttachmentItem[] } {
  const media: AttachmentItem[] = [];
  const docs: AttachmentItem[] = [];

  for (const item of items) {
    if (item.category === "image" || item.category === "video") {
      media.push(item);
    } else {
      docs.push(item);
    }
  }

  return { media, docs };
}

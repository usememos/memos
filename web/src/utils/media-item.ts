import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import {
  getAttachmentMotionClipUrl,
  getAttachmentMotionGroupId,
  getAttachmentThumbnailUrl,
  getAttachmentType,
  getAttachmentUrl,
  isAndroidMotionContainer,
  isAppleLivePhotoStill,
  isAppleLivePhotoVideo,
  isMotionAttachment,
} from "./attachment";

interface PreviewMediaItemBase {
  id: string;
  filename: string;
}

export interface ImagePreviewMediaItem extends PreviewMediaItemBase {
  kind: "image";
  sourceUrl: string;
  posterUrl?: string;
}

export interface VideoPreviewMediaItem extends PreviewMediaItemBase {
  kind: "video";
  sourceUrl: string;
  posterUrl?: string;
}

export interface MotionPreviewMediaItem extends PreviewMediaItemBase {
  kind: "motion";
  posterUrl: string;
  motionUrl: string;
  presentationTimestampUs?: bigint;
}

export type PreviewMediaItem = ImagePreviewMediaItem | VideoPreviewMediaItem | MotionPreviewMediaItem;

export interface AttachmentVisualItem {
  id: string;
  kind: "image" | "video" | "motion";
  filename: string;
  posterUrl: string;
  sourceUrl: string;
  attachmentNames: string[];
  attachments: Attachment[];
  previewItem: PreviewMediaItem;
  mimeType: string;
}

export function buildAttachmentVisualItems(attachments: Attachment[]): AttachmentVisualItem[] {
  const attachmentsByGroup = new Map<string, Attachment[]>();
  for (const attachment of attachments) {
    const groupId = getAttachmentMotionGroupId(attachment);
    if (!groupId) {
      continue;
    }
    const group = attachmentsByGroup.get(groupId) ?? [];
    group.push(attachment);
    attachmentsByGroup.set(groupId, group);
  }

  const consumedGroups = new Set<string>();
  const items: AttachmentVisualItem[] = [];

  for (const attachment of attachments) {
    if (isAndroidMotionContainer(attachment)) {
      items.push(buildAndroidMotionItem(attachment));
      continue;
    }

    const groupId = getAttachmentMotionGroupId(attachment);
    if (!groupId || consumedGroups.has(groupId)) {
      if (!groupId) {
        items.push(buildSingleAttachmentItem(attachment));
      }
      continue;
    }

    const group = attachmentsByGroup.get(groupId) ?? [];
    const still = group.find(isAppleLivePhotoStill);
    const video = group.find(isAppleLivePhotoVideo);
    if (still && video && group.length === 2) {
      items.push(buildAppleMotionItem(still, video));
      consumedGroups.add(groupId);
      continue;
    }

    items.push(buildSingleAttachmentItem(attachment));
    consumedGroups.add(groupId);
    for (const member of group) {
      if (member.name === attachment.name) {
        continue;
      }
      items.push(buildSingleAttachmentItem(member));
    }
  }

  return dedupeVisualItems(items);
}

export function countLogicalAttachmentItems(attachments: Attachment[]): number {
  const visualAttachments = attachments.filter(
    (attachment) =>
      getAttachmentType(attachment) === "image/*" || getAttachmentType(attachment) === "video/*" || isMotionAttachment(attachment),
  );
  const visualNames = new Set(visualAttachments.map((attachment) => attachment.name));
  const visualCount = buildAttachmentVisualItems(visualAttachments).length;
  const nonVisualCount = attachments.filter((attachment) => !visualNames.has(attachment.name)).length;
  return visualCount + nonVisualCount;
}

function buildSingleAttachmentItem(attachment: Attachment): AttachmentVisualItem {
  const attachmentType = getAttachmentType(attachment);
  const sourceUrl = getAttachmentUrl(attachment);
  const posterUrl = attachmentType === "image/*" ? getAttachmentThumbnailUrl(attachment) : sourceUrl;
  const previewKind = attachmentType === "video/*" ? "video" : "image";

  return {
    id: attachment.name,
    kind: attachmentType === "video/*" ? "video" : "image",
    filename: attachment.filename,
    posterUrl,
    sourceUrl,
    attachmentNames: [attachment.name],
    attachments: [attachment],
    previewItem: {
      id: attachment.name,
      kind: previewKind,
      sourceUrl,
      posterUrl,
      filename: attachment.filename,
    },
    mimeType: attachment.type,
  };
}

function buildAppleMotionItem(still: Attachment, video: Attachment): AttachmentVisualItem {
  const sourceUrl = getAttachmentUrl(video);
  const posterUrl = getAttachmentThumbnailUrl(still);

  return {
    id: getAttachmentMotionGroupId(still) ?? still.name,
    kind: "motion",
    filename: still.filename,
    posterUrl,
    sourceUrl,
    attachmentNames: [still.name, video.name],
    attachments: [still, video],
    previewItem: {
      id: getAttachmentMotionGroupId(still) ?? still.name,
      kind: "motion",
      posterUrl,
      motionUrl: sourceUrl,
      filename: still.filename,
    },
    mimeType: still.type,
  };
}

function buildAndroidMotionItem(attachment: Attachment): AttachmentVisualItem {
  return {
    id: attachment.name,
    kind: "motion",
    filename: attachment.filename,
    posterUrl: getAttachmentThumbnailUrl(attachment),
    sourceUrl: getAttachmentMotionClipUrl(attachment),
    attachmentNames: [attachment.name],
    attachments: [attachment],
    previewItem: {
      id: attachment.name,
      kind: "motion",
      motionUrl: getAttachmentMotionClipUrl(attachment),
      posterUrl: getAttachmentThumbnailUrl(attachment),
      filename: attachment.filename,
      presentationTimestampUs: attachment.motionMedia?.presentationTimestampUs,
    },
    mimeType: attachment.type,
  };
}

function dedupeVisualItems(items: AttachmentVisualItem[]): AttachmentVisualItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

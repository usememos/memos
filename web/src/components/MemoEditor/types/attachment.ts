import type { Attachment, MotionMedia } from "@/types/proto/api/v1/attachment_service_pb";
import { MotionMediaFamily, MotionMediaRole } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentThumbnailUrl, getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import { buildAttachmentVisualItems } from "@/utils/media-item";

export type FileCategory = "image" | "video" | "motion" | "audio" | "document";

export interface AttachmentItem {
  readonly id: string;
  readonly memberIds: string[];
  readonly filename: string;
  readonly category: FileCategory;
  readonly mimeType: string;
  readonly thumbnailUrl: string;
  readonly sourceUrl: string;
  readonly size?: number;
  readonly isLocal: boolean;
  readonly isVoiceNote: boolean;
  readonly audioMeta?: LocalFile["audioMeta"];
}

export interface LocalFile {
  readonly file: File;
  readonly previewUrl: string;
  readonly origin?: "audio_recording" | "upload";
  readonly audioMeta?: {
    readonly durationSeconds: number;
  };
  readonly motionMedia?: MotionMedia;
}

const AUDIO_RECORDING_FILENAME_RE = /^(?:voice-(?:recording|note)|audio-recording)-(\d{8})-(\d{4,6})/i;

export const isAudioRecordingFilename = (filename: string): boolean => AUDIO_RECORDING_FILENAME_RE.test(filename);

export const getAudioRecordingTimeLabel = (filename: string): string | undefined => {
  const match = filename.match(AUDIO_RECORDING_FILENAME_RE);
  const timePart = match?.[2];
  if (!timePart) {
    return undefined;
  }

  if (timePart.length === 4) {
    return `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
  }

  if (timePart.length === 6) {
    return `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
  }

  return undefined;
};

function categorizeFile(mimeType: string, motionMedia?: MotionMedia): FileCategory {
  if (motionMedia) return "motion";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function attachmentGroupToItem(attachment: Attachment): AttachmentItem {
  const attachmentType = getAttachmentType(attachment);
  const sourceUrl = getAttachmentUrl(attachment);

  return {
    id: attachment.name,
    memberIds: [attachment.name],
    filename: attachment.filename,
    category: categorizeFile(attachment.type),
    mimeType: attachment.type,
    thumbnailUrl: attachmentType === "image/*" ? getAttachmentThumbnailUrl(attachment) : sourceUrl,
    sourceUrl,
    size: Number(attachment.size),
    isLocal: false,
    isVoiceNote: categorizeFile(attachment.type) === "audio" && isAudioRecordingFilename(attachment.filename),
    audioMeta: undefined,
  };
}

function visualItemToAttachmentItem(item: ReturnType<typeof buildAttachmentVisualItems>[number]): AttachmentItem {
  return {
    id: item.id,
    memberIds: item.attachmentNames,
    filename: item.filename,
    category: item.kind === "motion" ? "motion" : item.kind,
    mimeType: item.mimeType,
    thumbnailUrl: item.posterUrl,
    sourceUrl: item.sourceUrl,
    size: item.attachments.reduce((total, attachment) => total + Number(attachment.size), 0),
    isLocal: false,
    isVoiceNote: false,
    audioMeta: undefined,
  };
}

function fileToItem(file: LocalFile): AttachmentItem {
  return {
    id: file.motionMedia?.groupId || file.previewUrl,
    memberIds: [file.previewUrl],
    filename: file.file.name,
    category: categorizeFile(file.file.type, file.motionMedia),
    mimeType: file.file.type,
    thumbnailUrl: file.previewUrl,
    sourceUrl: file.previewUrl,
    size: file.file.size,
    isLocal: true,
    isVoiceNote:
      categorizeFile(file.file.type, file.motionMedia) === "audio" &&
      (file.origin === "audio_recording" || isAudioRecordingFilename(file.file.name)),
    audioMeta: file.audioMeta,
  };
}

function toLocalMotionItems(localFiles: LocalFile[]): AttachmentItem[] {
  const grouped = new Map<string, LocalFile[]>();
  const singles: AttachmentItem[] = [];

  for (const localFile of localFiles) {
    const groupId = localFile.motionMedia?.groupId;
    if (!groupId) {
      singles.push(fileToItem(localFile));
      continue;
    }

    const group = grouped.get(groupId) ?? [];
    group.push(localFile);
    grouped.set(groupId, group);
  }

  const groupedItems = Array.from(grouped.entries()).flatMap(([groupId, files]) => {
    const still = files.find(
      (file) => file.motionMedia?.family === MotionMediaFamily.APPLE_LIVE_PHOTO && file.motionMedia.role === MotionMediaRole.STILL,
    );
    const video = files.find(
      (file) => file.motionMedia?.family === MotionMediaFamily.APPLE_LIVE_PHOTO && file.motionMedia.role === MotionMediaRole.VIDEO,
    );
    if (still && video && files.length === 2) {
      return [
        {
          id: groupId,
          memberIds: [still.previewUrl, video.previewUrl],
          filename: still.file.name,
          category: "motion" as const,
          mimeType: still.file.type,
          thumbnailUrl: still.previewUrl,
          sourceUrl: video.previewUrl,
          size: still.file.size + video.file.size,
          isLocal: true,
          isVoiceNote: false,
          audioMeta: undefined,
        },
      ];
    }

    return files.map(fileToItem);
  });

  return [...groupedItems, ...singles];
}

export function toAttachmentItems(attachments: Attachment[], localFiles: LocalFile[] = []): AttachmentItem[] {
  const visualAttachments = attachments.filter((attachment) => {
    const attachmentType = getAttachmentType(attachment);
    return attachmentType === "image/*" || attachmentType === "video/*" || attachment.motionMedia !== undefined;
  });
  const attachmentVisualIds = new Set<string>();
  const attachmentVisualItems = buildAttachmentVisualItems(visualAttachments).map((item) => {
    item.attachmentNames.forEach((name) => attachmentVisualIds.add(name));
    return visualItemToAttachmentItem(item);
  });

  const nonVisualAttachmentItems = attachments
    .filter((attachment) => !attachmentVisualIds.has(attachment.name))
    .map(attachmentGroupToItem)
    .filter((item) => item.category === "audio" || item.category === "document");

  return [...attachmentVisualItems, ...nonVisualAttachmentItems, ...toLocalMotionItems(localFiles)];
}

export function filterByCategory(items: AttachmentItem[], categories: FileCategory[]): AttachmentItem[] {
  const categorySet = new Set(categories);
  return items.filter((item) => categorySet.has(item.category));
}

export function separateMediaAndDocs(items: AttachmentItem[]): { media: AttachmentItem[]; docs: AttachmentItem[] } {
  const media: AttachmentItem[] = [];
  const docs: AttachmentItem[] = [];

  for (const item of items) {
    if (item.category === "image" || item.category === "video" || item.category === "motion") {
      media.push(item);
    } else {
      docs.push(item);
    }
  }

  return { media, docs };
}

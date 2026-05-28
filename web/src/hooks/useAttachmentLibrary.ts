import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useMemo } from "react";
import {
  getAttachmentMetadata,
  isAudioAttachment,
  isImageAttachment,
  isVideoAttachment,
} from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { useInfiniteAttachments } from "@/hooks/useAttachmentQueries";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { isMotionAttachment } from "@/utils/attachment";
import { useTranslate } from "@/utils/i18n";
import { type AttachmentVisualItem, buildAttachmentVisualItems } from "@/utils/media-item";

export type AttachmentLibraryTab = "media" | "documents" | "audio";

export interface AttachmentLibraryStats {
  unused: number;
  media: number;
  documents: number;
  audio: number;
}

export interface AttachmentLibraryListItem {
  attachment: Attachment;
  createdAt?: Date;
  createdLabel: string;
  fileTypeLabel: string;
  fileSizeLabel?: string;
  memoName?: string;
  sourceUrl: string;
}

export interface AttachmentLibraryMediaItem extends AttachmentVisualItem {
  primaryAttachment: Attachment;
  createdAt?: Date;
  createdLabel: string;
  fileTypeLabel: string;
}

export interface AttachmentLibraryMonthGroup {
  key: string;
  label: string;
  items: AttachmentLibraryMediaItem[];
}

const PAGE_SIZE = 50;

const sortByNewest = (a?: Date, b?: Date) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0);

const isLinkedAttachment = (attachment: Attachment) => Boolean(attachment.memo);

const isVisualAttachment = (attachment: Attachment) =>
  isImageAttachment(attachment) || isVideoAttachment(attachment) || isMotionAttachment(attachment);

const toCreatedAt = (attachment: Attachment): Date | undefined => {
  return attachment.createTime ? timestampDate(attachment.createTime) : undefined;
};

const formatCreatedAt = (date: Date | undefined, locale: string) => {
  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const toLibraryListItem = (attachment: Attachment, locale: string): AttachmentLibraryListItem => {
  const createdAt = toCreatedAt(attachment);
  const { fileTypeLabel, fileSizeLabel } = getAttachmentMetadata(attachment);

  return {
    attachment,
    createdAt,
    createdLabel: formatCreatedAt(createdAt, locale),
    fileTypeLabel,
    fileSizeLabel,
    memoName: attachment.memo,
    sourceUrl: attachment.externalLink || `${window.location.origin}/file/${attachment.name}/${attachment.filename}`,
  };
};

const toLibraryMediaItem = (item: AttachmentVisualItem, locale: string, livePhotoLabel: string): AttachmentLibraryMediaItem => {
  const primaryAttachment = item.attachments[0];
  const createdAt = toCreatedAt(primaryAttachment);
  const { fileTypeLabel } = getAttachmentMetadata(primaryAttachment);

  return {
    ...item,
    primaryAttachment,
    createdAt,
    createdLabel: formatCreatedAt(createdAt, locale),
    fileTypeLabel: item.kind === "motion" ? livePhotoLabel : fileTypeLabel,
  };
};

const groupMediaByMonth = (
  items: AttachmentLibraryMediaItem[],
  locale: string,
  unknownDateLabel: string,
): AttachmentLibraryMonthGroup[] => {
  const groups = new Map<string, AttachmentLibraryMediaItem[]>();

  for (const item of items) {
    const key = item.createdAt ? dayjs(item.createdAt).format("YYYY-MM") : "unknown";
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a)))
    .map(([key, groupedItems]) => ({
      key,
      label:
        key === "unknown"
          ? unknownDateLabel
          : dayjs(`${key}-01`).toDate().toLocaleDateString(locale, {
              month: "short",
              year: "numeric",
            }),
      items: groupedItems.sort((a, b) => sortByNewest(a.createdAt, b.createdAt)),
    }));
};

export function useAttachmentLibrary(locale: string) {
  const t = useTranslate();
  const query = useInfiniteAttachments({
    pageSize: PAGE_SIZE,
    orderBy: "create_time desc",
  });

  const attachments = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.attachments), [query.data?.pages]);

  const linkedAttachments = useMemo(
    () => attachments.filter(isLinkedAttachment).sort((a, b) => sortByNewest(toCreatedAt(a), toCreatedAt(b))),
    [attachments],
  );

  const unusedAttachments = useMemo(
    () => attachments.filter((attachment) => !isLinkedAttachment(attachment)).sort((a, b) => sortByNewest(toCreatedAt(a), toCreatedAt(b))),
    [attachments],
  );

  const mediaItems = useMemo(
    () =>
      buildAttachmentVisualItems(linkedAttachments.filter(isVisualAttachment))
        .map((item) => toLibraryMediaItem(item, locale, t("attachment-library.labels.live-photo")))
        .sort((a, b) => sortByNewest(a.createdAt, b.createdAt)),
    [linkedAttachments, locale, t],
  );

  const documentItems = useMemo(
    () =>
      linkedAttachments
        .filter((attachment) => !isVisualAttachment(attachment) && !isAudioAttachment(attachment))
        .map((attachment) => toLibraryListItem(attachment, locale)),
    [linkedAttachments, locale],
  );

  const audioItems = useMemo(
    () => linkedAttachments.filter(isAudioAttachment).map((attachment) => toLibraryListItem(attachment, locale)),
    [linkedAttachments, locale],
  );

  const unusedItems = useMemo(
    () => unusedAttachments.map((attachment) => toLibraryListItem(attachment, locale)),
    [unusedAttachments, locale],
  );

  const mediaGroups = useMemo(
    () => groupMediaByMonth(mediaItems, locale, t("attachment-library.labels.unknown-date")),
    [locale, mediaItems, t],
  );
  const mediaPreviewItems = useMemo(() => mediaItems.map((item) => item.previewItem), [mediaItems]);

  const stats = useMemo<AttachmentLibraryStats>(
    () => ({
      unused: unusedAttachments.length,
      media: mediaItems.length,
      documents: documentItems.length,
      audio: audioItems.length,
    }),
    [audioItems.length, documentItems.length, mediaItems.length, unusedAttachments.length],
  );

  return {
    ...query,
    attachments,
    mediaGroups,
    mediaItems,
    mediaPreviewItems,
    documentItems,
    audioItems,
    unusedItems,
    stats,
  };
}

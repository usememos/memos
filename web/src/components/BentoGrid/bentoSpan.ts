import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentType, isImage } from "@/utils/attachment";

/** Bento row height targets in px; the album solves the final row height. */
export const BENTO_ROW_UNIT = 260;
export const BENTO_ROW_UNIT_SMALL = 220;
/** Below this container width the smaller row target keeps tiles readable. */
export const BENTO_SMALL_WIDTH = 640;

const isVisualAttachment = (type: string) => isImage(type) || type.startsWith("video/");

/** The display aspect ratio (width/height) of the memo's hero media, when known. */
export const memoVisualAspect = (memo: Memo): number | undefined => {
  const attachment = (memo.attachments ?? []).find((candidate) => isVisualAttachment(getAttachmentType(candidate)));
  const width = attachment?.mediaMetadata?.width;
  const height = attachment?.mediaMetadata?.height;
  if (width && height && width > 0 && height > 0) {
    return width / height;
  }
  const link = (memo.property?.links ?? []).find(
    (candidate) => candidate.coverAttachmentUid && candidate.coverWidth && candidate.coverHeight,
  );
  if (link && link.coverWidth > 0 && link.coverHeight > 0) {
    return link.coverWidth / link.coverHeight;
  }
  return undefined;
};

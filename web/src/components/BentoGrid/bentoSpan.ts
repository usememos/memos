import { GRID_GAP } from "@/components/ColumnGrid";
import { estimateMemoCardHeight } from "@/components/PagedMemoList/memoCardHeight";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentType, isImage } from "@/utils/attachment";

/** Bento row height in px; rowSpan multiplies this. */
export const BENTO_ROW_UNIT = 260;
export const BENTO_ROW_UNIT_SMALL = 220;
/** Below this container width the smaller row unit keeps tiles readable. */
export const BENTO_SMALL_WIDTH = 640;

const MAX_ROW_SPAN = 3;

export interface BentoSpanOptions {
  columnCount: number;
  columnWidth: number;
  rowUnit?: number;
}

export interface BentoSpan {
  colSpan: number;
  rowSpan: number;
}

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

/**
 * Featured memos get hero tiles: pinned notes, link bookmarks with a stored cover, and
 * memos carrying at least one image/video attachment.
 */
export const isFeaturedMemo = (memo: Memo): boolean =>
  memo.pinned ||
  (memo.property?.links ?? []).some((link) => Boolean(link.coverAttachmentUid)) ||
  (memo.attachments ?? []).some((attachment) => isVisualAttachment(getAttachmentType(attachment)));

/**
 * Deterministic bento tile spans. When the media aspect ratio is known, the image drives
 * the tile shape (landscape → wide, portrait → tall, clamped to MAX_ROW_SPAN); text still
 * participates via the card-height estimator so long notes never clip. Without dimensions,
 * featured heuristics and the estimator keep today's behavior.
 */
export const bentoSpan = (memo: Memo, { columnCount, columnWidth, rowUnit = BENTO_ROW_UNIT }: BentoSpanOptions): BentoSpan => {
  if (columnCount < 2) return { colSpan: 1, rowSpan: 1 };
  const estimatedRows = Math.min(MAX_ROW_SPAN, Math.max(1, Math.ceil(estimateMemoCardHeight(memo, { columnWidth }) / rowUnit)));
  const aspect = memoVisualAspect(memo);
  if (aspect !== undefined) {
    const imageRows =
      aspect > 1.2
        ? Math.ceil((columnWidth * 2 + GRID_GAP) / aspect / rowUnit)
        : Math.abs(aspect - 1) <= 0.2
          ? Math.ceil((columnWidth * 2) / rowUnit)
          : Math.ceil(columnWidth / aspect / rowUnit);
    return {
      colSpan: aspect >= 0.8 ? 2 : 1,
      rowSpan: Math.min(MAX_ROW_SPAN, Math.max(imageRows, estimatedRows, 1)),
    };
  }
  if (isFeaturedMemo(memo)) {
    return { colSpan: 2, rowSpan: Math.max(estimatedRows, 2) };
  }
  return { colSpan: 1, rowSpan: estimatedRows };
};

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

/**
 * Featured memos get hero tiles: pinned notes, link bookmarks with a stored cover, and
 * memos carrying at least one image/video attachment.
 */
export const isFeaturedMemo = (memo: Memo): boolean =>
  memo.pinned ||
  (memo.property?.links ?? []).some((link) => Boolean(link.coverAttachmentUid)) ||
  (memo.attachments ?? []).some((attachment) => isVisualAttachment(getAttachmentType(attachment)));

/**
 * Deterministic bento tile spans. rowSpan comes from the card-height estimator, so tiles
 * grow rows with content instead of clipping; featured memos additionally span two columns
 * with a 2-row floor so they read as heroes.
 */
export const bentoSpan = (memo: Memo, { columnCount, columnWidth, rowUnit = BENTO_ROW_UNIT }: BentoSpanOptions): BentoSpan => {
  if (columnCount < 2) return { colSpan: 1, rowSpan: 1 };
  const estimatedRows = Math.ceil(estimateMemoCardHeight(memo, { columnWidth }) / rowUnit);
  const rowSpan = Math.min(MAX_ROW_SPAN, Math.max(1, estimatedRows));
  if (isFeaturedMemo(memo)) {
    return { colSpan: 2, rowSpan: Math.max(rowSpan, 2) };
  }
  return { colSpan: 1, rowSpan };
};

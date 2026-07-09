import { CLAMP_PREVIEW_HEIGHT_PX, CLAMP_TRIGGER_HEIGHT_PX } from "@/components/ClampedSection";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentType, isMotionAttachment } from "@/utils/attachment";
import { buildAttachmentVisualItems } from "@/utils/media-item";

interface EstimateMemoCardHeightOptions {
  columnWidth: number;
}

const CARD_VERTICAL_PADDING = 24;
const CARD_HEADER_HEIGHT = 32;
const CARD_SECTION_GAP = 8;
const SHOW_MORE_BUTTON_HEIGHT = 28;

const CONTENT_HORIZONTAL_PADDING = 32;
const CONTENT_AVERAGE_CHAR_WIDTH = 7;
const CONTENT_LINE_HEIGHT = 22;
const CONTENT_MIN_CHARS_PER_LINE = 18;

const MARKDOWN_IMAGE_HEIGHT = 220;
const SINGLE_IMAGE_HEIGHT = 260;
const SINGLE_VIDEO_ASPECT_RATIO = 9 / 16;
const TWO_VISUAL_ITEMS_HEIGHT = 240;
const MOSAIC_VISUAL_ITEMS_HEIGHT = 288;
const SIX_VISUAL_ITEMS_HEIGHT = 320;
const ATTACHMENT_SECTION_HEADER_HEIGHT = 36;
const ATTACHMENT_SECTION_PADDING = 16;
const ATTACHMENT_SECTION_GAP = 8;
const AUDIO_ATTACHMENT_ROW_HEIGHT = 92;
const DOCUMENT_ATTACHMENT_ROW_HEIGHT = 64;

const REACTION_ROW_HEIGHT = 28;
const COMMENT_PREVIEW_HEADER_HEIGHT = 20;
const COMMENT_PREVIEW_ROW_HEIGHT = 44;
const COMMENT_PREVIEW_VERTICAL_PADDING = 20;
const MAX_VISIBLE_COMMENT_PREVIEWS = 3;

const estimateWrappedTextHeight = (content: string, columnWidth: number): number => {
  const textWidth = Math.max(1, columnWidth - CONTENT_HORIZONTAL_PADDING);
  const charsPerLine = Math.max(CONTENT_MIN_CHARS_PER_LINE, Math.floor(textWidth / CONTENT_AVERAGE_CHAR_WIDTH));
  const lineCount = content.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return lineCount * CONTENT_LINE_HEIGHT;
};

const countMarkdownImages = (content: string): number => {
  const markdownImages = content.match(/!\[[^\]]*]\([^)]+\)/g)?.length ?? 0;
  const htmlImages = content.match(/<img\s/gi)?.length ?? 0;
  return markdownImages + htmlImages;
};

const isVisualAttachment = (attachment: Attachment): boolean => {
  const type = getAttachmentType(attachment);
  return type === "image/*" || type === "video/*" || isMotionAttachment(attachment);
};

const isAudioAttachment = (attachment: Attachment): boolean => getAttachmentType(attachment) === "audio/*";

const estimateVisualGalleryHeight = (visualAttachments: Attachment[], columnWidth: number): number => {
  const count = buildAttachmentVisualItems(visualAttachments).length;
  if (count === 0) return 0;
  if (count === 1) {
    const type = getAttachmentType(visualAttachments[0]!);
    return type === "video/*" ? Math.round(columnWidth * SINGLE_VIDEO_ASPECT_RATIO) : SINGLE_IMAGE_HEIGHT;
  }
  if (count === 2) return TWO_VISUAL_ITEMS_HEIGHT;
  if (count <= 4) return MOSAIC_VISUAL_ITEMS_HEIGHT;
  return SIX_VISUAL_ITEMS_HEIGHT;
};

const estimateAttachmentSectionHeight = (attachments: Attachment[], columnWidth: number): number => {
  if (attachments.length === 0) return 0;

  const visual = attachments.filter(isVisualAttachment);
  const audio = attachments.filter(isAudioAttachment);
  const docs = attachments.filter((attachment) => !isVisualAttachment(attachment) && !isAudioAttachment(attachment));
  const contentParts = [
    estimateVisualGalleryHeight(visual, columnWidth),
    audio.length > 0 ? audio.length * AUDIO_ATTACHMENT_ROW_HEIGHT + Math.max(0, audio.length - 1) * ATTACHMENT_SECTION_GAP : 0,
    docs.length > 0 ? docs.length * DOCUMENT_ATTACHMENT_ROW_HEIGHT + Math.max(0, docs.length - 1) * ATTACHMENT_SECTION_GAP : 0,
  ].filter((height) => height > 0);

  const contentHeight =
    contentParts.reduce((total, height) => total + height, 0) + Math.max(0, contentParts.length - 1) * ATTACHMENT_SECTION_GAP;
  return ATTACHMENT_SECTION_HEADER_HEIGHT + ATTACHMENT_SECTION_PADDING + contentHeight;
};

const countCommentRelations = (memo: Memo): number =>
  (memo.relations ?? []).filter((relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memo.name)
    .length;

const estimateCommentPreviewHeight = (memo: Memo): number => {
  const visibleCommentCount = Math.min(countCommentRelations(memo), MAX_VISIBLE_COMMENT_PREVIEWS);
  if (visibleCommentCount === 0) return 0;
  return COMMENT_PREVIEW_VERTICAL_PADDING + COMMENT_PREVIEW_HEADER_HEIGHT + visibleCommentCount * COMMENT_PREVIEW_ROW_HEIGHT;
};

export const estimateMemoCardHeight = (memo: Memo, { columnWidth }: EstimateMemoCardHeightOptions): number => {
  const content = memo.content ?? "";
  const contentHeight = estimateWrappedTextHeight(content, columnWidth) + countMarkdownImages(content) * MARKDOWN_IMAGE_HEIGHT;
  const attachmentHeight = estimateAttachmentSectionHeight(memo.attachments ?? [], columnWidth);
  const bodyHeight = contentHeight + attachmentHeight + (contentHeight > 0 && attachmentHeight > 0 ? CARD_SECTION_GAP : 0);
  const compactBodyHeight = bodyHeight > CLAMP_TRIGGER_HEIGHT_PX ? CLAMP_PREVIEW_HEIGHT_PX + SHOW_MORE_BUTTON_HEIGHT : bodyHeight;
  const reactionHeight = (memo.reactions ?? []).length > 0 ? CARD_SECTION_GAP + REACTION_ROW_HEIGHT : 0;

  return (
    CARD_VERTICAL_PADDING + CARD_HEADER_HEIGHT + CARD_SECTION_GAP + compactBodyHeight + reactionHeight + estimateCommentPreviewHeight(memo)
  );
};

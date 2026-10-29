import {
  type BlockNode,
  type BlockQuoteNode,
  type InlineNode,
  inlineNodesText,
  type ListItemNode,
  type RawNode,
  type Root,
  visit,
} from "@usememos/editor";
import dayjs from "dayjs";
import type { MemoTimeBasis } from "@/contexts/ViewContext";
import { getMemoSortTime } from "@/hooks/useMemoSorting";
import { ISO_DATE_FORMAT } from "@/lib/calendar-utils";
import { allowedAttributeValue } from "@/lib/html-sanitize-schema";
import { parseMemoAst } from "@/lib/memo-ast";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { getAttachmentThumbnailUrl, getAttachmentUrl, isImage } from "@/utils/attachment";
import { classifyManagedAttachmentImageURL, extractAttachmentUIDFromName } from "@/utils/managed-attachment";

export interface CalendarDayExcerpt {
  memoName: string;
  /** The memo's creator, so a mixed-author scope can attribute the preview. */
  creator: string;
  text: string;
  isCode: boolean;
}

export interface CalendarDayImage {
  memoName: string;
  thumbnailUrl: string;
}

export interface CalendarDaySummary {
  /** Every memo, including hidden ones, in chronological order for the day panel. */
  memos: Memo[];
  /** Each creator once, in the order they first wrote that day; a hidden memo still names its author. */
  creators: string[];
  excerpt?: CalendarDayExcerpt;
  /** At most one image per memo, from the first two eligible image-bearing memos. */
  images: CalendarDayImage[];
}

export type CalendarMonthModel = Record<string, CalendarDaySummary>;

export interface BuildCalendarMonthModelOptions {
  /** Hidden memos count, but never contribute text, filenames, or images. */
  isRedacted?: (memo: Memo) => boolean;
}

// A GitHub alert's first line, such as "[!NOTE]", which the memo shows as the callout's title.
const ALERT_MARKER = /^\[!(?:note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i;

/** Whether a blockquote is a GitHub alert: its text, not code or a link, starts with the marker line. */
const isAlert = (node: BlockQuoteNode): boolean => {
  const first = node.children[0];
  const lead = first?.type === "paragraph" ? first.children[0] : undefined;
  return lead?.type === "text" && ALERT_MARKER.test(lead.value);
};

const FOOTNOTE_LABEL = /^\[\^(?:[^\]\s\\]|\\.)+\]:[ \t]?/;

/**
 * A footnote definition's text as a tree of its own. The editor keeps a definition as a raw
 * block, so a walk over the memo does not see the Markdown in it. Its lines go on indented
 * by up to four spaces; the memo's link reference definitions still resolve in it.
 */
const footnoteTree = (node: RawNode, memo: Root): Root => {
  const lines = node.value.replace(FOOTNOTE_LABEL, "").split("\n");
  const text = lines.map((line, index) => (index === 0 ? line : line.replace(/^(?: {1,4}|\t)/, ""))).join("\n");
  return parseMemoAst([text, ...memo.definitions].join("\n\n"));
};

/**
 * Inline nodes without image alt text, which is not a written excerpt, without raw HTML, which
 * is never rendered, and without footnote references, which are labels.
 */
const prose = (nodes: readonly InlineNode[]): InlineNode[] =>
  nodes.flatMap<InlineNode>((node) => {
    if (node.type === "image" || node.type === "html" || (node.type === "token" && node.name === "footnote")) return [];
    return "children" in node ? [{ ...node, children: prose(node.children) }] : [node];
  });

// A soft break is a line break in a memo (`breaks: true`).
const inlineText = (nodes: readonly InlineNode[]): string => inlineNodesText(prose(nodes), "\n");

const plainText = (node: BlockNode | ListItemNode, memo: Root): string => {
  const children = (nodes: readonly (BlockNode | ListItemNode)[]) => nodes.map((child) => plainText(child, memo)).join("\n");
  switch (node.type) {
    case "paragraph":
    case "heading":
      return inlineText(node.children);
    case "codeBlock":
      return node.value;
    case "blockQuote": {
      const text = children(node.children);
      return isAlert(node) ? text.replace(ALERT_MARKER, "") : text;
    }
    case "list":
      return children(node.items);
    case "listItem":
      return children(node.children);
    case "table":
      return node.rows.map((row) => row.map(inlineText).join("\n")).join("\n");
    case "raw":
      // A formula reads as its TeX and a footnote as its text; other extension blocks are not the memo's text.
      if (node.name === "footnote") return children(footnoteTree(node, memo).children);
      return node.name === "math" ? node.value : "";
    default:
      // Dividers, and raw HTML, which is never rendered.
      return "";
  }
};

const getExcerpt = (memo: Memo, tree: Root): CalendarDayExcerpt | undefined => {
  const blocks = tree.children;
  const readable = blocks
    .map((block) => ({ text: plainText(block, tree).trim(), isCode: block.type === "codeBlock" }))
    .filter(({ text }) => text);
  const text =
    readable
      .map((block) => block.text)
      .join("\n")
      .trim() || (!memo.content.trim() ? memo.snippet.trim() : "");
  if (!text) return undefined;
  return {
    memoName: memo.name,
    creator: memo.creator,
    text: text.length > 280 ? `${text.slice(0, 280).trimEnd()}…` : text,
    isCode: readable[0]?.isCode ?? false,
  };
};

/**
 * Markdown image sources in reading order, footnotes included, with references resolved in the
 * tree, under the memo view's source policy: relative or https only. Raw HTML is deliberately
 * excluded: only Markdown images contribute to this preview.
 */
const contentImageSources = (tree: Root, memo: Root = tree): string[] => {
  const sources: string[] = [];
  visit(tree, (node) => {
    if (node.type === "raw" && node.name === "footnote") sources.push(...contentImageSources(footnoteTree(node, memo), memo));
    if (node.type !== "image") return;
    const source = allowedAttributeValue("img", "src", node.destination);
    if (source) sources.push(source);
  });
  return sources;
};

const imageKey = (source: string): string => {
  try {
    return new URL(source, window.location.href).href;
  } catch {
    return source;
  }
};

const getImageCandidates = (memo: Memo, tree: Root): string[] => {
  const candidates: string[] = [];
  const attachments = memo.attachments.filter((attachment) => isImage(attachment.type));
  for (const source of contentImageSources(tree)) {
    const classified = classifyManagedAttachmentImageURL(source);
    if (classified.kind === "invalid") continue;
    const attachment = attachments.find((candidate) =>
      classified.kind === "managed"
        ? extractAttachmentUIDFromName(candidate.name) === classified.uid
        : imageKey(getAttachmentUrl(candidate)) === imageKey(source),
    );
    // A managed image uses the attachment's thumbnail URL, just like an attached image.
    // Missing managed attachments must not be treated as external image URLs.
    if (classified.kind === "managed" && !attachment) continue;
    candidates.push(attachment ? getAttachmentThumbnailUrl(attachment) : source);
  }
  candidates.push(...attachments.map(getAttachmentThumbnailUrl));
  return candidates;
};

/**
 * The thumbnail of a memo's first photo, chosen the way a calendar day chooses its photos:
 * Markdown images in reading order, then image attachments. Content with neither is not parsed.
 */
export const getMemoThumbnail = (memo: Memo): string | undefined => {
  if (!memo.content.includes("![") && !memo.attachments.some((attachment) => isImage(attachment.type))) return undefined;
  return getImageCandidates(memo, parseMemoAst(memo.content))[0];
};

/** Fold the month into stable day snapshots, independent of API pagination/order. */
export const buildCalendarMonthModel = (
  memos: Memo[],
  timeBasis: MemoTimeBasis,
  { isRedacted }: BuildCalendarMonthModelOptions = {},
): CalendarMonthModel => {
  const dated = memos
    .map((memo) => ({ memo, time: getMemoSortTime(memo, timeBasis) }))
    .filter((entry): entry is { memo: Memo; time: Date } => entry.time !== undefined)
    .sort((a, b) => a.time.getTime() - b.time.getTime() || a.memo.name.localeCompare(b.memo.name));

  const model: CalendarMonthModel = {};
  const fileFallbacks = new Map<string, CalendarDayExcerpt>();
  for (const { memo, time } of dated) {
    const date = dayjs(time).format(ISO_DATE_FORMAT);
    const summary = (model[date] ??= { memos: [], creators: [], images: [] });
    summary.memos.push(memo);
    if (!summary.creators.includes(memo.creator)) summary.creators.push(memo.creator);
    if (isRedacted?.(memo)) continue;
    const tree = !summary.excerpt || summary.images.length < 2 ? parseMemoAst(memo.content) : undefined;
    if (!summary.excerpt && tree) summary.excerpt = getExcerpt(memo, tree);
    if (!fileFallbacks.has(date)) {
      const file = memo.attachments.find((attachment) => !isImage(attachment.type) && !attachment.motionMedia?.groupId);
      if (file?.filename) fileFallbacks.set(date, { memoName: memo.name, creator: memo.creator, text: file.filename, isCode: false });
    }
    if (summary.images.length >= 2 || !tree) continue;
    const usedImages = new Set(summary.images.map((image) => imageKey(image.thumbnailUrl)));
    const thumbnailUrl = getImageCandidates(memo, tree).find((source) => !usedImages.has(imageKey(source)));
    if (thumbnailUrl) summary.images.push({ memoName: memo.name, thumbnailUrl });
  }
  for (const [date, summary] of Object.entries(model)) {
    summary.excerpt ??= fileFallbacks.get(date);
  }
  return model;
};

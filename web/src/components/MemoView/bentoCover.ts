import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { getAttachmentType, getAttachmentUrl, getMemoCoverUrl, isImage } from "@/utils/attachment";

/**
 * Cover source for bento tiles: the locally cached link cover when the memo carries one,
 * otherwise the first image attachment.
 */
export const getBentoCoverUrl = (memo: Memo, shareToken?: string): string | undefined => {
  const linkCover = (memo.property?.links ?? []).find((link) => Boolean(link.coverAttachmentUid))?.coverAttachmentUid;
  if (linkCover) {
    return getMemoCoverUrl(memo.name, linkCover, shareToken);
  }
  const image = (memo.attachments ?? []).find((attachment) => isImage(getAttachmentType(attachment)));
  return image ? getAttachmentUrl(image) : undefined;
};

/** Compact, human-readable source for link tiles. */
export const getBentoTileSource = (memo: Memo): string => {
  for (const link of memo.property?.links ?? []) {
    if (!URL.canParse(link.url)) {
      continue;
    }
    const hostname = new URL(link.url).hostname.replace(/^www\./, "");
    if (hostname) {
      return hostname;
    }
  }
  return "";
};

const stripMarkdown = (line: string): string =>
  line
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#*>`~]/g, "")
    .trim();

/** Tile title: the first stored link title, else the first meaningful content line. */
export const getBentoTileTitle = (memo: Memo): string => {
  const linkTitle = (memo.property?.links ?? []).find((link) => Boolean(link.title))?.title;
  if (linkTitle) {
    return linkTitle;
  }
  const firstLine = (memo.content ?? "")
    .split("\n")
    .map((line) => stripMarkdown(line))
    .find((line) => line.length > 0);
  return firstLine ?? "";
};

/** Tile body snippet: subsequent lines for non-cover text cards. */
export const getBentoTileSnippet = (memo: Memo): string => {
  const lines = (memo.content ?? "")
    .split("\n")
    .map((line) => stripMarkdown(line))
    .filter((line) => line.length > 0);
  const remaining = lines.slice(1).join(" ");
  return remaining.trim();
};

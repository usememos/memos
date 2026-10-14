import { type Block, type Editor, inlineText } from "@usememos/editor";
import { getYouTubeVideoId } from "./YouTubePreview";

/** App UI mounted into the read-only editor's DOM with a portal. */
export type Island = { key: string; target: HTMLElement; href: string; videoId?: string };

let islandCounter = 0;
/** Stable portal keys per target element, so a second pass does not remount mounted islands. */
const islandKeys = new WeakMap<HTMLElement, string>();
const islandKey = (target: HTMLElement): string => {
  let key = islandKeys.get(target);
  if (!key) {
    key = `island-${++islandCounter}`;
    islandKeys.set(target, key);
  }
  return key;
};

/** The URL a paragraph consists of, when it is nothing but one bare web link: `https://…` written as its own text. */
function bareLinkOf(block: Block): string | undefined {
  if (block.type !== "paragraph" || block.content.length === 0) return undefined;
  const href = block.content[0].link;
  // Only web links have metadata to preview; `tel:`/`sms:`/`mailto:` hand off to another app.
  if (!href || !/^https?:\/\//i.test(href)) return undefined;
  if (!block.content.every((span) => span.link === href && !span.image)) return undefined;
  return inlineText(block.content) === href ? href : undefined;
}

/** Rich-text paste and typing can store the explicit marker as escaped text. */
function literalYouTubeLinkOf(block: Block): string | undefined {
  if (block.type !== "paragraph") return undefined;
  if (block.content.some((span) => span.image || span.token || span.marks.includes("code") || span.marks.includes("html"))) {
    return undefined;
  }
  const match = /^\[YOUTUBE\]\((https?:\/\/[^\s()]+)\)$/.exec(inlineText(block.content).trim());
  const href = match?.[1];
  if (!href || !getYouTubeVideoId(href)) return undefined;
  if (block.content.some((span) => span.link && span.link !== href)) return undefined;
  return href;
}

const blockElement = (root: HTMLElement, blockId: string) => root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);

/**
 * The places in the read-only editor's DOM where memos' own UI takes over: a link card
 * in place of a paragraph that is one bare link, which needs the page's details from the
 * memos server, and thumbnails inside explicit YOUTUBE links. Safe to run
 * repeatedly: targets keep their keys, and only new targets are prepared.
 */
export function findIslands(editor: Editor, root: HTMLElement, linkPreviewEnabled: boolean): Island[] {
  const islands: Island[] = [];
  for (const block of editor.state.doc.blocks) {
    const youtubeHref = literalYouTubeLinkOf(block);
    if (youtubeHref) {
      const paragraph = blockElement(root, block.id);
      if (paragraph && !paragraph.querySelector("a[data-youtube-preview]")) {
        const anchor = root.ownerDocument.createElement("a");
        anchor.href = youtubeHref;
        anchor.textContent = "YOUTUBE";
        paragraph.replaceChildren(anchor);
      }
      continue;
    }
    const href = linkPreviewEnabled ? bareLinkOf(block) : undefined;
    const target = href ? blockElement(root, block.id) : null;
    if (!href || !target) continue;
    if (!target.hasAttribute("data-link-preview")) {
      target.setAttribute("data-link-preview", "");
      target.replaceChildren();
    }
    islands.push({ key: islandKey(target), target, href });
  }
  for (const target of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (target.closest("[data-link-preview]")) continue;
    if (!target.hasAttribute("data-youtube-preview") && target.textContent !== "YOUTUBE") continue;
    const href = target.getAttribute("href") ?? "";
    const videoId = getYouTubeVideoId(href);
    if (!videoId) continue;
    if (!target.hasAttribute("data-youtube-preview")) {
      target.setAttribute("data-youtube-preview", "");
      target.setAttribute("aria-label", "YouTube");
      target.setAttribute("target", "_blank");
      target.setAttribute("rel", "noopener noreferrer");
      target.replaceChildren();
    }
    islands.push({ key: islandKey(target), target, href, videoId });
  }
  return islands;
}

/** Whether two passes produced the same islands, so React can skip a render. */
export const sameIslands = (a: readonly Island[], b: readonly Island[]): boolean =>
  a.length === b.length &&
  a.every(
    (island, index) =>
      island.key === b[index].key &&
      island.target === b[index].target &&
      island.href === b[index].href &&
      island.videoId === b[index].videoId,
  );

import { type Block, type Editor, inlineText } from "@usememos/editor";

/** App UI mounted into the read-only editor's DOM with a portal. */
export type Island = { key: string; target: HTMLElement; href: string };

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

const blockElement = (root: HTMLElement, blockId: string) => root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);

/**
 * The places in the read-only editor's DOM where memos' own UI takes over: a link card
 * in place of a paragraph that is one bare link, which needs the page's details from the
 * memos server. Everything else the view shows comes from the editor. Safe to run
 * repeatedly: targets keep their keys, and only new targets are prepared.
 */
export function findIslands(editor: Editor, root: HTMLElement, linkPreviewEnabled: boolean): Island[] {
  const islands: Island[] = [];
  for (const block of editor.state.doc.blocks) {
    const href = linkPreviewEnabled ? bareLinkOf(block) : undefined;
    const target = href ? blockElement(root, block.id) : null;
    if (!href || !target) continue;
    if (!target.hasAttribute("data-link-preview")) {
      target.setAttribute("data-link-preview", "");
      target.replaceChildren();
    }
    islands.push({ key: islandKey(target), target, href });
  }
  return islands;
}

/** Whether two passes produced the same islands, so React can skip a render. */
export const sameIslands = (a: readonly Island[], b: readonly Island[]): boolean =>
  a.length === b.length &&
  a.every((island, index) => island.key === b[index].key && island.target === b[index].target && island.href === b[index].href);

import { type Block, type Extension, inlineText } from "@usememos/editor";

/** The URL a paragraph consists of, when it is nothing but one bare web link: `https://…` written as its own text. */
export function bareLinkOf(block: Block): string | undefined {
  if (block.type !== "paragraph" || block.content.length === 0) return undefined;
  const href = block.content[0].link;
  // Only web links have metadata to preview; `tel:`/`sms:`/`mailto:` hand off to another app.
  if (!href || !/^https?:\/\//i.test(href)) return undefined;
  // A titled link is a written `[text](url "title")`, never a bare URL; a card would drop its title.
  if (!block.content.every((span) => span.link === href && !span.linkTitle && !span.image)) return undefined;
  return inlineText(block.content) === href ? href : undefined;
}

/** A card's place in the editor: the element the editor owns for the block, and the link it shows. */
export interface LinkCardMount {
  readonly element: HTMLElement;
  readonly href: string;
}

export interface LinkCardsHooks {
  /** Read when the editor draws a block; `editor.refreshViews("linkCards")` applies a change. */
  isEnabled: () => boolean;
  /** The editor has an element for a bare-link paragraph; the host mounts its card into it. */
  onMount: (mount: LinkCardMount) => void;
  /** The editor let the element go: the block was removed or changed, or the view was refreshed. */
  onUnmount: (element: HTMLElement) => void;
}

/**
 * The link preview cards, as the editor's own block view: a paragraph that is one bare
 * web link is drawn by the host, which needs the page's details from the memos server.
 * The editor keeps the element while the block is unchanged, so the card the host mounts
 * into it (a React portal) survives renders, and calls `onUnmount` when it lets it go.
 */
export const linkCardsExtension = (hooks: LinkCardsHooks): Extension => ({
  name: "linkCards",
  blockView: {
    match: (block) => hooks.isEnabled() && bareLinkOf(block) !== undefined,
    render: (block, element) => {
      const href = bareLinkOf(block);
      if (!href) return false;
      hooks.onMount({ element, href });
      return () => hooks.onUnmount(element);
    },
  },
});

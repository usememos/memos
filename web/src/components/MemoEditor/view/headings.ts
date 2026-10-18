import { inlineText } from "@usememos/editor";
import { RESERVED_MEMO_COMMENTS_ANCHOR_IDS } from "@/lib/memo-comments";
import { parseMemoMarkdown } from "@/lib/memo-markdown";
import { createUniqueSlugGenerator, slugify } from "@/utils/markdown-manipulation";

/** Anchor used for headings with no slugifiable characters (emoji- or punctuation-only titles). */
const FALLBACK_HEADING_SLUG = "heading";

export interface HeadingItem {
  text: string;
  level: 1 | 2 | 3 | 4;
  slug: string;
}

/**
 * The anchor of every heading, in document order. This is the single place a heading
 * anchor is decided: the memo view gives these to the editor as element ids
 * (`headingIds`) and the outline links to them, so an outline link always has somewhere
 * to land. Every heading consumes a slug, including h5/h6 and titles that slugify to
 * nothing, because duplicate suffixes depend on how many headings came before.
 */
export function headingSlugs(headings: readonly { readonly text: string }[]): string[] {
  const makeUniqueSlug = createUniqueSlugGenerator(RESERVED_MEMO_COMMENTS_ANCHOR_IDS);
  return headings.map(({ text }) => makeUniqueSlug(slugify(text.trim()) || FALLBACK_HEADING_SLUG));
}

/**
 * Every heading is ATX (up to three spaces, then 1–6 `#` and a space); setext is disabled.
 * Content matching neither cannot produce a heading, which lets the common short memo skip
 * the parse below. False positives (a `#` inside a code fence) only cost the parse.
 */
const MAYBE_HAS_HEADING = /^[ \t]{0,3}#{1,6}[ \t]/m;

/** h1–h4 headings for outline navigation, read the way the memo view reads the memo. */
export function extractHeadings(markdown: string): HeadingItem[] {
  if (!MAYBE_HAS_HEADING.test(markdown)) return [];
  const headings = parseMemoMarkdown(markdown).blocks.flatMap((block) =>
    block.type === "heading" ? [{ text: inlineText(block.content).trim(), level: block.level }] : [],
  );
  const slugs = headingSlugs(headings);
  return headings.flatMap((heading, index) =>
    heading.level <= 4 && heading.text ? [{ text: heading.text, level: heading.level as HeadingItem["level"], slug: slugs[index]! }] : [],
  );
}

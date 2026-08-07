import type { Element, Root as HastRoot } from "hast";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type PluggableList, unified } from "unified";
import { visit } from "unist-util-visit";
import { getHeadingText, isHeadingElement, rehypeHeadingId } from "@/utils/rehype-plugins/rehype-heading-id";
import { remarkDisableSetext } from "@/utils/remark-plugins/remark-disable-setext";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkSplitMixedTaskLists } from "@/utils/remark-plugins/remark-split-mixed-task-lists";
import { remarkMemoSyntax } from "@/utils/remark-plugins/remark-tag";
import { SANITIZE_SCHEMA } from "./constants";

/**
 * The memo markdown pipeline, in one place. The renderer and the outline both build from these,
 * so anything that changes which headings exist or what they read as — disabling setext,
 * unwrapping raw HTML, sanitizing away elements — applies to both or neither.
 */
export const buildRemarkPlugins = (mathRemarkPlugins: PluggableList = []): PluggableList => [
  remarkDisableSetext,
  ...mathRemarkPlugins,
  remarkGfm,
  remarkSplitMixedTaskLists,
  remarkMemoSyntax,
  remarkBreaks,
  remarkPreserveType,
];

export const buildRehypePlugins = (mathRehypePlugins: PluggableList = []): PluggableList => [
  rehypeRaw,
  [rehypeSanitize, SANITIZE_SCHEMA],
  rehypeHeadingId,
  ...mathRehypePlugins,
];

export interface HeadingItem {
  text: string;
  level: 1 | 2 | 3 | 4;
  slug: string;
}

/**
 * Screen-reader-only headings are generated scaffolding, not memo content — remark-rehype labels
 * the footnote section with one. They are rendered (and keep an anchor) but stay out of the outline.
 */
function isVisuallyHidden(node: Element): boolean {
  const className = node.properties?.className;
  return Array.isArray(className) && className.includes("sr-only");
}

/**
 * Every heading is either ATX (up to three spaces, then 1–6 `#` and a space) or written as raw
 * HTML — setext is disabled, and no plugin in the chain invents one. Content matching neither
 * cannot produce a heading, which lets the common short memo skip the parse below. False
 * positives (a `#` inside a code fence) only cost the work we would otherwise have done anyway.
 */
const MAYBE_HAS_HEADING = /^[ \t]{0,3}#{1,6}[ \t]|<h[1-6][\s/>]/im;

/**
 * Extract h1–h4 headings for outline navigation by running the memo through the same pipeline
 * the renderer uses and reading the ids `rehypeHeadingId` assigned. The slugs are the rendered
 * ids rather than a second guess at them, so an outline link always has somewhere to land.
 *
 * Math plugins are left out: they are lazy-loaded for bundle size, and the only heading text they
 * change is `$…$` delimiters, which slugify strips either way.
 */
export function extractHeadings(markdown: string): HeadingItem[] {
  if (!MAYBE_HAS_HEADING.test(markdown)) return [];

  const processor = unified()
    .use(remarkParse)
    .use(buildRemarkPlugins())
    // rehype-raw needs the raw HTML kept in the tree, exactly as react-markdown configures it.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(buildRehypePlugins());

  const tree = processor.runSync(processor.parse(markdown)) as HastRoot;
  const headings: HeadingItem[] = [];

  visit(tree, "element", (node: Element) => {
    if (!isHeadingElement(node) || isVisuallyHidden(node)) return;

    const level = Number(node.tagName.slice(1));
    if (level > 4) return;

    const text = getHeadingText(node);
    const slug = typeof node.properties?.id === "string" ? node.properties.id : "";
    if (!text || !slug) return;

    headings.push({ text, level: level as 1 | 2 | 3 | 4, slug });
  });

  return headings;
}

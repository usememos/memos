import { cn } from "@/lib/utils";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Per-level heading type (size / line height / weight / color), shared by the
 * read-only memo view and the editor's heading-line decorations so a heading
 * looks the same while editing and after saving. The scale stays close to the
 * 16px body: headings organize a note, they are not page titles.
 */
const headingTypeClasses: Record<HeadingLevel, string> = {
  1: "text-2xl/8 font-semibold",
  2: "text-xl/7 font-semibold",
  3: "text-lg/6.5 font-semibold",
  4: "text-base/6 font-semibold",
  5: "text-base/6 font-semibold",
  6: "text-base/6 font-semibold text-muted-foreground",
};

/**
 * Read-only view spacing: more room above than below so a heading binds to the
 * content it introduces; no top margin when it opens its container.
 */
const headingSpacingClasses: Record<HeadingLevel, string> = {
  1: "mt-5 mb-2 first:mt-0",
  2: "mt-5 mb-2 first:mt-0",
  3: "mt-5 mb-1.5 first:mt-0",
  4: "mt-4 mb-1 first:mt-0",
  5: "mt-4 mb-1 first:mt-0",
  6: "mt-4 mb-1 first:mt-0",
};

/**
 * Complete heading class per level, precomputed once at module load (spacing +
 * type). headingClass is a hot path — MemoContent renders it per heading on
 * every content render — so the cn() merge happens here, not per call.
 */
const headingClasses: Record<HeadingLevel, string> = {
  1: cn(headingSpacingClasses[1], headingTypeClasses[1]),
  2: cn(headingSpacingClasses[2], headingTypeClasses[2]),
  3: cn(headingSpacingClasses[3], headingTypeClasses[3]),
  4: cn(headingSpacingClasses[4], headingTypeClasses[4]),
  5: cn(headingSpacingClasses[5], headingTypeClasses[5]),
  6: cn(headingSpacingClasses[6], headingTypeClasses[6]),
};

/**
 * Single source of truth for the styling of common markdown elements rendered
 * by the read-only memo view (MemoContent). Each value is a complete, standalone
 * Tailwind class string so it can be dropped onto a DOM element as-is (MemoContent
 * merges them with `cn`). The editor does not use these — it styles its raw
 * markdown source via CodeMirror decorations in `MemoEditor/Editor/theme.ts`
 * (headings excepted: see `headingTypeClass`).
 *
 * Block rhythm: every block is `my-0 mb-2` (8px between blocks, none above the
 * first), and MemoContent trims the last block's margin. Headings and the
 * horizontal rule are the only blocks with their own vertical spacing; images
 * are inline content and keep a small margin of their own.
 *
 * These are static string literals so Tailwind's JIT scanner detects them.
 */
export const markdownStyles = {
  paragraph: "my-0 mb-2 leading-6",
  // No italic: synthesized obliques render poorly for CJK text.
  blockquote: "my-0 mb-2 border-s-3 border-muted-foreground/25 ps-3 text-muted-foreground",
  // Direct-child selectors keep each nested disclosure's indicator independent.
  details: "my-0 mb-2 min-w-0 ps-5 [&[open]>summary]:mb-1 [&[open]>summary>svg]:rotate-90 [&>*:last-child]:mb-0",
  summary:
    "relative -ms-5 block cursor-pointer list-none rounded-sm ps-5 pe-1 font-normal leading-6 [overflow-wrap:anywhere] transition-colors hover:bg-muted/50 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
  disclosureIcon:
    "pointer-events-none absolute start-0.5 top-1.25 size-3.5 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none rtl:rotate-180",
  bulletList: "my-0 mb-2 list-outside ps-6 list-disc marker:text-muted-foreground",
  orderedList: "my-0 mb-2 list-outside ps-6 list-decimal marker:text-muted-foreground",
  // Task list indentation comes from the task item grid columns, not padding.
  taskList: "my-0 mb-2 list-outside list-none",
  // Trimming the last child keeps nested lists and loose-item paragraphs from
  // adding a gap before the next sibling item.
  listItem: "mt-0.5 leading-6 [&>*:last-child]:mb-0",
  // Shared by the read-only task item (MemoContent/markdown/List.tsx) and the
  // editor so the checkbox + text grid stays identical in both.
  taskListItem: "mt-0.5 min-w-0 leading-6 list-none grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 [&>[data-slot=checkbox]]:mt-1",
  taskItemContent: "min-w-0 [overflow-wrap:anywhere] [&>*:last-child]:mb-0",
  // Relative size so code inside headings scales with the heading.
  inlineCode: "font-mono text-[0.875em] bg-muted px-1 py-0.5 rounded-md",
  link: "text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary",
  horizontalRule: "my-4 h-0 border-0 border-b border-border",
  image: "max-w-full my-2 rounded-lg",
} as const;

/** Complete heading class for a given level (spacing + type). */
export const headingClass = (level: HeadingLevel): string => headingClasses[level];

/** Heading type alone (no spacing), for the editor's heading-line decorations. */
export const headingTypeClass = (level: HeadingLevel): string => headingTypeClasses[level];

/**
 * Tag pill styling for the read-only memo view (MemoContent/Tag.tsx). Split into
 * two tokens so the viewer can swap `defaultColor` for an inline custom color.
 * (The editor does not use these; it colors `#tag` source via the
 * `cm-memo-tag` decoration in Editor/theme.ts.)
 */
export const tagStyles = {
  /** Shape, padding, and typography — always applied. */
  base: "inline-flex items-center align-baseline px-1.5 py-0.5 text-[0.9em] leading-none font-normal rounded-full border",
  /** Default theme color, used when no custom tag color is set. */
  defaultColor: "border-primary text-primary bg-primary/15",
} as const;

/**
 * `@mention` styling for the read-only memo view (MemoContent/Mention.tsx).
 * Unlike a tag this is not a pill — it is a primary-colored accent (the read-only
 * view adds `hover:underline` for its link). (The editor does not use these; it
 * colors `@mention` source via the `cm-memo-mention` decoration in
 * Editor/theme.ts.)
 */
export const mentionStyles = {
  base: "text-primary underline-offset-2",
} as const;

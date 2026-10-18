export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Per-level heading type (size / line height / weight / color). The composer and
 * the memo view are the same Markdown editor, so a heading looks the same while
 * editing and after saving. The scale stays close to the 16px body: headings
 * organize a note, they are not page titles.
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
 * App classes for Markdown elements, handed to the editor's `theme.classes`
 * (lib/memo-markdown.ts) and used by the app UI that renders into memos (link
 * cards, raw HTML). Block spacing is the editor's own. Each value is a complete,
 * static Tailwind class string so Tailwind's JIT scanner detects it.
 */
export const markdownStyles = {
  // Relative size so code inside headings scales with the heading.
  inlineCode: "font-mono text-[0.875em] bg-muted px-1 py-0.5 rounded-md",
  link: "text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary",
  image: "max-w-full my-2 rounded-lg",
} as const;

/** Heading type for a level: size, line height, weight and color. */
export const headingTypeClass = (level: HeadingLevel): string => headingTypeClasses[level];

/**
 * Tag pill styling for the memo view. Split into two tokens so the view can swap
 * `defaultColor` for a custom tag color (MemoEditor/view/MemoContentView.tsx). The composer
 * colors tags as text instead (MemoEditor/MemoMarkdown.tsx).
 */
export const tagStyles = {
  /** Shape, padding, and typography — always applied. */
  base: "inline-flex items-center align-baseline px-1.5 py-0.5 text-[0.9em] leading-none font-normal rounded-full border",
  /** Default theme color, used when no custom tag color is set. */
  defaultColor: "border-primary text-primary bg-primary/15",
} as const;

/**
 * `@mention` styling for a resolved mention in the memo view. Unlike a tag this is
 * not a pill — it is a primary-colored accent, underlined on hover.
 */
export const mentionStyles = {
  base: "text-primary underline-offset-2",
} as const;

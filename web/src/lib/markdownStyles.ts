export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Per-level heading classes for the editor's `theme.classes.heading`. Size, line
 * height and weight are the editor's own: it scales h1–h3 from its `fontSize` and
 * `lineHeight` tokens (1.5×, 1.25× and 1.125×, each with the body's leading) and
 * sets h4–h6 at the body size, in its own unlayered stylesheet, so a Tailwind size
 * here would never apply and a changed token would not reach it. Only what the
 * editor leaves to the app goes here. The composer and the memo view are the same
 * Markdown editor, so a heading looks the same while editing and after saving.
 */
export const headingClasses: Readonly<Partial<Record<HeadingLevel, string>>> = {
  6: "text-muted-foreground",
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

/**
 * `#tag` styling wherever the editor shows a memo. In rich text and the memo view a tag
 * is a pill, in the theme color or the color the user gave it; in source mode the
 * `rich:` variant (index.css) leaves only the text and its color, as the editor's own
 * syntax highlighting does around it.
 */
export const tagStyles = {
  /** The pill: shape, padding and typography. */
  base: "rich:inline-flex rich:items-center rich:align-baseline rich:px-1.5 rich:py-0.5 rich:text-[0.9em] rich:leading-none rich:font-normal rich:rounded-full rich:border",
  /** The theme color, used when the tag has no color of its own. */
  defaultColor: "text-primary rich:border-primary rich:bg-primary/15",
  /** The user's color, read from `--tag-color` on the element: the text darkened for contrast, the pill a light tint of it. */
  customColor:
    "text-[color:color-mix(in_srgb,var(--tag-color)_60%,black)] rich:border-(--tag-color) rich:bg-[color-mix(in_srgb,var(--tag-color)_15%,transparent)]",
} as const;

/**
 * `@mention` styling for a resolved mention in the memo view. Unlike a tag this is
 * not a pill — it is a primary-colored accent, underlined on hover.
 */
export const mentionStyles = {
  base: "text-primary underline-offset-2",
} as const;

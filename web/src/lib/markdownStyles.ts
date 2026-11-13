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
  6: "text-mu-text-secondary",
};

/**
 * App classes for Markdown elements, handed to the editor's `theme.classes`
 * (lib/memo-markdown.ts) and used by the app UI that renders into memos (link
 * cards, raw HTML). Block spacing is the editor's own. Each value is a complete,
 * static Tailwind class string so Tailwind's JIT scanner detects it.
 */
export const markdownStyles = {
  // Relative size so code inside headings scales with the heading.
  inlineCode: "font-mono text-[0.875em] bg-mu-well px-1 py-0.5 rounded-mu-md",
  link: "text-mu-accent underline decoration-mu-accent/50 underline-offset-2 transition-colors hover:decoration-mu-accent",
  image: "max-w-full my-2 rounded-mu-lg",
} as const;

/**
 * `#tag` styling wherever the editor shows a memo. In rich text and the memo view a tag
 * is a chip in the Badge's grammar (20px, 4px corners, a quiet fill, no outline) at caption
 * size, in the well or a tint of the color the user gave it; in source mode the `rich:`
 * variant (index.css) leaves only the text and its color, as the editor's own syntax
 * highlighting does around it. The size is spelled out because `mu-caption` can't carry
 * the variant and source mode must keep the editor's own size.
 */
export const tagStyles = {
  /** The pill: shape, padding and typography. */
  base: "rich:inline-flex rich:h-5 rich:items-center rich:align-baseline rich:rounded-mu-sm rich:px-1.5 rich:text-[13px] rich:leading-[18px] rich:font-normal",
  /** Ink in the well, used when the tag has no color of its own. */
  defaultColor: "text-mu-text rich:bg-mu-well",
  /**
   * The user's color, read from `--tag-color` on the element, as the package's Badge `color` draws
   * it: an 18% tint behind ink text, the same in both themes. The text never takes the color, since
   * no chosen color is readable as text on its own tint in both themes.
   */
  customColor: "text-mu-text rich:bg-[color-mix(in_srgb,var(--tag-color)_18%,transparent)]",
} as const;

/**
 * `@mention` styling for a resolved mention in the memo view. Unlike a tag this is
 * not a pill — it is a primary-colored accent, underlined on hover.
 */
export const mentionStyles = {
  base: "text-mu-accent underline-offset-2",
} as const;

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
  codeBlock: "bg-mu-well!",
  // Keep the editor's white checkmark readable when Dark uses a pale accent.
  taskList:
    "[--mbe-border:var(--mu-control-edge)] [--mbe-accent:light-dark(var(--mu-accent),color-mix(in_oklab,var(--mu-accent)_55%,var(--mu-surface)))]",
  link: "text-mu-accent underline decoration-mu-accent/50 underline-offset-2 transition-colors hover:decoration-mu-accent",
  image: "max-w-full my-2 rounded-mu-lg",
} as const;

/**
 * `#tag` styling wherever the editor shows a memo. In rich text and the memo view a tag
 * inherits the surrounding typography with a quiet inline fill. In source mode the
 * `rich:` variant (index.css) leaves only the text and its color.
 */
export const tagStyles = {
  base: "rich:inline rich:rounded-mu-sm rich:border rich:border-transparent rich:px-0.5 rich:box-decoration-clone",
  interactive: "mu-focus rich:focus-visible:border-mu-focus touch-manipulation",
  /** Ink in the well, used when the tag has no color of its own. */
  defaultColor: "text-mu-text rich:bg-mu-well rich:[&[role=button]]:hover:bg-mu-hover",
  /**
   * The user's color, read from `--tag-color` on the element, as the package's Badge `color` draws
   * it: lightness kept between 50% and 75%, then clipped to sRGB before the 18% tint.
   * The text stays ink so user-chosen colors cannot reduce its contrast.
   */
  customColor:
    "text-mu-text rich:[--tag-tint:color(from_oklch(from_var(--tag-color)_clamp(0.5,l,0.75)_c_h)_srgb_clamp(0,r,1)_clamp(0,g,1)_clamp(0,b,1))] rich:bg-[color-mix(in_srgb,var(--tag-tint)_18%,transparent)] rich:[&[role=button]]:hover:bg-[color-mix(in_srgb,var(--tag-tint)_26%,transparent)]",
} as const;

/**
 * `@mention` styling for a resolved mention in the memo view. Unlike a tag this is
 * not a pill — it is a primary-colored accent, underlined on hover.
 */
export const mentionStyles = {
  base: "text-mu-accent underline-offset-2",
} as const;

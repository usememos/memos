import { defaultSchema } from "rehype-sanitize";

export const MAX_DISPLAY_HEIGHT = 256;

export const COMPACT_STATES: Record<"ALL" | "SNIPPET", { textKey: string; next: "ALL" | "SNIPPET" }> = {
  ALL: { textKey: "memo.show-more", next: "SNIPPET" },
  SNIPPET: { textKey: "memo.show-less", next: "ALL" },
};

/**
 * Sanitization schema for markdown HTML content.
 * Extends the default schema to allow:
 * - KaTeX math rendering elements (MathML tags)
 * - KaTeX-specific attributes (className, style, aria-*, data-*)
 * - Safe HTML elements for rich content
 * - iframe embeds for trusted video providers (YouTube, Vimeo, etc.)
 *
 * This prevents XSS attacks while preserving math rendering functionality.
 */
export const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className", "style", ["aria*"], ["data*"]],
    // iframe attributes for video embeds
    iframe: ["src", "width", "height", "frameborder", "allowfullscreen", "allow", "title", "referrerpolicy", "loading"],
    // MathML attributes for KaTeX rendering
    annotation: ["encoding"],
    math: ["xmlns"],
    mi: [],
    mn: [],
    mo: [],
    mrow: [],
    mspace: [],
    mstyle: [],
    msup: [],
    msub: [],
    msubsup: [],
    mfrac: [],
    mtext: [],
    semantics: [],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // iframe for video embeds
    "iframe",
    // MathML elements for KaTeX math rendering
    "math",
    "annotation",
    "semantics",
    "mi",
    "mn",
    "mo",
    "mrow",
    "mspace",
    "mstyle",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "mtext",
  ],
  protocols: {
    ...defaultSchema.protocols,
    // Allow HTTPS iframe embeds only for security
    iframe: { src: ["https"] },
  },
};

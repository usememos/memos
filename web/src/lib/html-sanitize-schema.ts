import { defaultSchema } from "rehype-sanitize";

const TRUSTED_IFRAME_SRC_PATTERNS = [
  /^https:\/\/www\.youtube\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/player\.vimeo\.com\/video\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/open\.spotify\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/w\.soundcloud\.com\/player\/?(?:\?.*)?$/i,
  /^https:\/\/www\.loom\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.google\.com\/maps\/embed(?:\/[^?#]*)?(?:\?.*)?$/i,
  /^https:\/\/(?:app\.)?diagrams\.net\/(?:[^?#]+)?(?:\?.*)?$/i,
  /^https:\/\/(?:www\.)?draw\.io\/(?:[^?#]+)?(?:\?.*)?$/i,
];

const KATEX_INLINE_CLASS_NAMES = ["language-math", "math-inline"] as const;
const KATEX_BLOCK_CLASS_NAMES = ["language-math", "math-display"] as const;
const SPAN_CLASS_NAMES = ["mention", "tag"] as const;
const INPUT_ATTRIBUTES = [...(defaultSchema.attributes?.input || []), ["checked", true]] as const;

/**
 * Link schemes the browser hands off to another app (dialer, messaging) instead of navigating.
 * They cannot run script, so they are as safe as the `mailto:` the default schema already allows.
 */
const HANDOFF_LINK_PROTOCOLS = ["tel", "sms"];

export const isTrustedIframeSrc = (src: string): boolean => TRUSTED_IFRAME_SRC_PATTERNS.some((pattern) => pattern.test(src));

/**
 * Sanitization schema for raw HTML in memos (lib/sanitized-html.ts) and for images the
 * calendar reads from memo content. Extends the default schema to allow:
 * - the math and tag/mention class names the previous renderer emitted
 * - iframe embeds only from trusted providers
 * - `tel:` and `sms:` links
 *
 * This prevents XSS attacks from user-written HTML.
 */
export const SANITIZE_SCHEMA = {
  ...defaultSchema,
  // Don't re-prefix `id`/`name` attributes. remark-rehype already namespaces footnote ids with
  // `user-content-` and emits matching `#user-content-…` hrefs; the default schema's clobbering
  // would prepend a *second* `user-content-` to the ids only (not the hrefs), breaking in-page
  // navigation. Leaving ids untouched keeps footnote (and heading) anchors pointing at real targets.
  clobber: [],
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img || []), "height", "width"],
    input: INPUT_ATTRIBUTES,
    code: [...(defaultSchema.attributes?.code || []), ["className", ...KATEX_INLINE_CLASS_NAMES, ...KATEX_BLOCK_CLASS_NAMES]],
    span: [...(defaultSchema.attributes?.span || []), ["className", ...SPAN_CLASS_NAMES], ["aria*"], ["data*"]],
    iframe: [
      ["src", ...TRUSTED_IFRAME_SRC_PATTERNS],
      "width",
      "height",
      "frameborder",
      "allowfullscreen",
      "allow",
      "title",
      "referrerpolicy",
      "loading",
    ],
  },
  // `picture`/`source` carry `srcSet`, which the https-only `src` rule below does not cover;
  // drop them so every remote image goes through the `img` `src` rule.
  tagNames: [...(defaultSchema.tagNames || []).filter((tag) => tag !== "picture" && tag !== "source"), "iframe"],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href || []), ...HANDOFF_LINK_PROTOCOLS],
    src: ["https"],
  },
};

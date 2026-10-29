const TRUSTED_IFRAME_SRC_PATTERNS = [
  /^https:\/\/www\.youtube\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/player\.vimeo\.com\/video\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/player\.bilibili\.com\/player\.html(?:\?.*)?$/i,
  /^https:\/\/open\.spotify\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/w\.soundcloud\.com\/player\/?(?:\?.*)?$/i,
  /^https:\/\/www\.loom\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.google\.com\/maps\/embed(?:\/[^?#]*)?(?:\?.*)?$/i,
  /^https:\/\/(?:app\.)?diagrams\.net\/(?:[^?#]+)?(?:\?.*)?$/i,
  /^https:\/\/(?:www\.)?draw\.io\/(?:[^?#]+)?(?:\?.*)?$/i,
];

export const isTrustedIframeSrc = (src: string): boolean => TRUSTED_IFRAME_SRC_PATTERNS.some((pattern) => pattern.test(src));

/**
 * The elements raw HTML in a memo may hold: GitHub's allowlist, less `picture` and
 * `source`, whose `srcset` the https-only `src` rule below does not cover, so every
 * remote image goes through `img`; plus `iframe`, for trusted embeds only.
 */
export const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "span",
  "strike",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tt",
  "ul",
  "var",
];

/** Attributes every allowed element may carry, as on GitHub. */
const GLOBAL_ATTRIBUTES = [
  "abbr",
  "accept",
  "accept-charset",
  "accesskey",
  "action",
  "align",
  "alt",
  "axis",
  "border",
  "cellpadding",
  "cellspacing",
  "char",
  "charoff",
  "charset",
  "checked",
  "clear",
  "colspan",
  "color",
  "cols",
  "compact",
  "coords",
  "datetime",
  "dir",
  "enctype",
  "frame",
  "hspace",
  "headers",
  "height",
  "hreflang",
  "for",
  "id",
  "ismap",
  "itemprop",
  "label",
  "lang",
  "maxlength",
  "media",
  "method",
  "multiple",
  "name",
  "nohref",
  "noshade",
  "nowrap",
  "open",
  "prompt",
  "readonly",
  "rev",
  "rowspan",
  "rows",
  "rules",
  "scope",
  "selected",
  "shape",
  "size",
  "span",
  "start",
  "summary",
  "tabindex",
  "title",
  "usemap",
  "valign",
  "value",
  "width",
];

const ARIA_LABELS = ["aria-describedby", "aria-label", "aria-labelledby"];

/** Attributes allowed on one element beyond the global ones. */
const ELEMENT_ATTRIBUTES: Record<string, readonly string[]> = {
  a: [...ARIA_LABELS, "data-footnote-backref", "data-footnote-ref", "class", "href"],
  blockquote: ["cite"],
  code: ["class"],
  del: ["cite"],
  div: ["itemscope", "itemtype"],
  dl: ARIA_LABELS,
  h2: ["class"],
  iframe: ["src", "width", "height", "frameborder", "allowfullscreen", "allow", "title", "referrerpolicy", "loading"],
  img: [...ARIA_LABELS, "longdesc", "src"],
  input: ["disabled", "type", "checked"],
  ins: ["cite"],
  li: ["class"],
  ol: [...ARIA_LABELS, "class"],
  q: ["cite"],
  section: ["data-footnotes", "class"],
  span: ["class"],
  summary: ARIA_LABELS,
  table: ARIA_LABELS,
  ul: [...ARIA_LABELS, "class"],
};

/** Attribute prefixes allowed on one element: tag and mention spans carry their data. */
const ELEMENT_ATTRIBUTE_PREFIXES: Record<string, readonly string[]> = {
  span: ["aria-", "data-"],
};

/** The class names an element may carry; others are dropped from its `class`. Includes the math and tag/mention classes the previous renderer emitted. */
const CLASS_NAMES: Record<string, readonly (string | RegExp)[]> = {
  a: ["data-footnote-backref"],
  code: [/^language-./, "math-inline", "math-display"],
  h2: ["sr-only"],
  li: ["task-list-item"],
  ol: ["contains-task-list"],
  section: ["footnotes"],
  span: ["mention", "tag"],
  ul: ["contains-task-list"],
};

/**
 * The URL schemes an attribute may use; a relative URL is always allowed. Links also allow
 * `tel:` and `sms:`, which hand off to another app (dialer, messaging) instead of navigating;
 * they cannot run script, so they are as safe as `mailto:`. Sources load over https only.
 */
const URL_PROTOCOLS: Record<string, readonly string[]> = {
  cite: ["http", "https"],
  href: ["http", "https", "irc", "ircs", "mailto", "xmpp", "tel", "sms"],
  longdesc: ["http", "https"],
  src: ["https"],
};

/** Every attribute name some element may carry, for the sanitizer's own first pass. */
export const ALLOWED_ATTRIBUTES = [...new Set([...GLOBAL_ATTRIBUTES, ...Object.values(ELEMENT_ATTRIBUTES).flat()])];

/** Whether a URL is relative, or uses one of `protocols`: a colon after the first `/`, `?` or `#` is not a scheme. */
const hasAllowedProtocol = (url: string, protocols: readonly string[]): boolean => {
  const colon = url.indexOf(":");
  const end = [url.indexOf("/"), url.indexOf("?"), url.indexOf("#")].filter((index) => index !== -1);
  if (colon === -1 || end.some((index) => colon > index)) return true;
  return protocols.includes(url.slice(0, colon).toLowerCase());
};

/**
 * What of an attribute raw HTML in a memo may keep on element `tag`: its value, the class
 * names allowed there, or null to drop it. Event handlers and styles are never allowed.
 */
export const allowedAttributeValue = (tag: string, name: string, value: string): string | null => {
  const allowed =
    GLOBAL_ATTRIBUTES.includes(name) ||
    ELEMENT_ATTRIBUTES[tag]?.includes(name) ||
    ELEMENT_ATTRIBUTE_PREFIXES[tag]?.some((prefix) => name.startsWith(prefix));
  if (!allowed) return null;
  if (name === "class") {
    const patterns = CLASS_NAMES[tag] ?? [];
    const names = value
      .split(/\s+/)
      .filter((token) => patterns.some((pattern) => (typeof pattern === "string" ? pattern === token : pattern.test(token))));
    return names.length ? names.join(" ") : null;
  }
  if (tag === "iframe" && name === "src") return isTrustedIframeSrc(value) ? value : null;
  const protocols = URL_PROTOCOLS[name];
  return protocols && !hasAllowedProtocol(value.trim(), protocols) ? null : value;
};

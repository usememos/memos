import type { Element, Properties, Root, RootContent } from "hast";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { isTrustedIframeSrc, SANITIZE_SCHEMA } from "@/lib/html-sanitize-schema";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";

const BILIBILI_PLAYER_SRC = /^https:\/\/player\.bilibili\.com\/player\.html(?:\?|$)/i;

/**
 * Normalizes every `src` to a lowercase `https:` URL before sanitization. The sanitizer's
 * protocol allowlist is case-sensitive, so `HTTPS://…` would be dropped, and it treats a
 * scheme-relative `//host/…` as a relative URL, which an HTTP deployment would load over
 * plain HTTP. Bilibili's share dialog emits a scheme-relative iframe, and its player starts
 * playing on load unless the URL says `autoplay=0`.
 */
const normalizeSources = (tree: Root): void => {
  visit(tree, "element", (node) => {
    const src = node.properties.src;
    if (typeof src !== "string") return;
    const trimmed = src.trim();
    let normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed.replace(/^https:/i, "https:");
    if (node.tagName === "iframe" && BILIBILI_PLAYER_SRC.test(normalized)) {
      const url = new URL(normalized);
      if (!url.searchParams.has("autoplay")) url.searchParams.set("autoplay", "0");
      normalized = url.href;
    }
    node.properties.src = normalized;
  });
};

/**
 * Raw HTML in a memo, such as a `<details>` section or a trusted video embed,
 * as the memo view shows it. Loaded on demand: the editor keeps an HTML block
 * as source, and this turns that source into sanitized DOM. Markdown between
 * the tags is rendered too, as GitHub does.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(() => normalizeSources)
  .use([[rehypeSanitize, SANITIZE_SCHEMA]]);

const ATTRIBUTE_NAMES: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  acceptCharset: "accept-charset",
  httpEquiv: "http-equiv",
};

/** The HTML attribute for a hast property name: `className` → `class`, `dataFooBar` → `data-foo-bar`, `ariaLabel` → `aria-label`. */
const attributeName = (property: string): string => {
  if (ATTRIBUTE_NAMES[property]) return ATTRIBUTE_NAMES[property];
  if (/^data[A-Z]/.test(property)) return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  if (/^aria[A-Z]/.test(property)) return `aria-${property.slice(4).toLowerCase()}`;
  return property.toLowerCase();
};

const setAttributes = (element: HTMLElement, properties: Properties | undefined) => {
  for (const [property, value] of Object.entries(properties ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    const attribute = attributeName(property);
    if (value === true) element.setAttribute(attribute, "");
    else element.setAttribute(attribute, Array.isArray(value) ? value.join(" ") : String(value));
  }
};

/** Memo-view styling and safe defaults for the few elements that need them. */
const finishElement = (element: HTMLElement, node: Element): HTMLElement | null => {
  switch (node.tagName) {
    case "a":
      if (!element.getAttribute("href")?.startsWith("#")) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
      element.className = cn(markdownStyles.link, element.className);
      break;
    case "img":
      element.setAttribute("loading", "lazy");
      element.setAttribute("decoding", "async");
      element.setAttribute("referrerpolicy", "no-referrer");
      element.className = cn(markdownStyles.image, element.className);
      break;
    case "iframe":
      if (!isTrustedIframeSrc(element.getAttribute("src") ?? "")) return null;
      // Share snippets without a size (Bilibili's) would otherwise render at the browser's 300×150.
      element.className = cn(
        "max-w-full rounded-lg border border-border",
        !node.properties.width && !node.properties.height && "w-full aspect-video",
        element.className,
      );
      break;
    case "details":
      element.className = cn("my-0 mb-2", element.className);
      break;
    case "summary":
      element.className = cn("cursor-pointer", element.className);
      break;
    case "input":
      element.setAttribute("disabled", "");
      break;
  }
  return element;
};

const toDom = (node: RootContent): Node | null => {
  if (node.type === "text") return document.createTextNode(node.value);
  if (node.type !== "element") return null;
  const element = document.createElement(node.tagName);
  setAttributes(element, node.properties);
  for (const child of node.children) {
    const childNode = toDom(child);
    if (childNode) element.appendChild(childNode);
  }
  return finishElement(element, node);
};

/**
 * Renders raw HTML source into `target` as sanitized DOM, replacing what it held. A
 * block is rendered as written; an inline run (`<kbd>Ctrl</kbd>`) without the
 * paragraph Markdown would wrap it in.
 */
export function renderSanitizedHtml(source: string, target: HTMLElement, kind: "inline" | "block" = "block"): void {
  const tree = processor.runSync(processor.parse(source)) as Root;
  const nodes = tree.children.flatMap((child) => {
    const node = toDom(child);
    return node ? [node] : [];
  });
  const only = nodes.filter((node) => !(node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()));
  const unwrap = kind === "inline" && only.length === 1 && only[0] instanceof HTMLParagraphElement;
  target.replaceChildren(...(unwrap ? Array.from(only[0].childNodes) : nodes));
}

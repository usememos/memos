import DOMPurify from "dompurify";
import { ALLOWED_ATTRIBUTES, ALLOWED_TAGS, allowedAttributeValue, isTrustedIframeSrc } from "@/lib/html-sanitize-schema";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";

const BILIBILI_PLAYER_SRC = /^https:\/\/player\.bilibili\.com\/player\.html(?:\?|$)/i;

/**
 * Normalizes every `src` to a lowercase `https:` URL before sanitization, so the trusted
 * iframe hosts match it. A scheme-relative `//host/…` would otherwise count as a relative
 * URL, which an HTTP deployment would load over plain HTTP. Bilibili's share dialog emits a
 * scheme-relative iframe, and its player starts playing on load unless the URL says
 * `autoplay=0`. The tree is not in the page yet, so nothing loads before the sanitizer runs.
 */
const normalizeSources = (root: ParentNode): void => {
  for (const element of Array.from(root.querySelectorAll("[src]"))) {
    const trimmed = element.getAttribute("src")!.trim();
    let normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed.replace(/^https:/i, "https:");
    if (element.localName === "iframe" && BILIBILI_PLAYER_SRC.test(normalized)) {
      const url = new URL(normalized);
      if (!url.searchParams.has("autoplay")) url.searchParams.set("autoplay", "0");
      normalized = url.href;
    }
    element.setAttribute("src", normalized);
  }
};

/** Memo-view styling and safe defaults for the few elements that need them; false drops the element. */
const finishElement = (element: Element): boolean => {
  switch (element.localName) {
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
      if (!isTrustedIframeSrc(element.getAttribute("src") ?? "")) return false;
      // Share snippets without a size (Bilibili's) would otherwise render at the browser's 300×150.
      element.className = cn(
        "max-w-full rounded-lg border border-border",
        !element.hasAttribute("width") && !element.hasAttribute("height") && "w-full aspect-video",
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
      element.setAttribute("type", "checkbox");
      element.setAttribute("disabled", "");
      break;
  }
  return true;
};

const purify = DOMPurify(window);
purify.addHook("uponSanitizeAttribute", (node, data) => {
  const value = allowedAttributeValue(node.localName, data.attrName, data.attrValue);
  if (value === null) data.keepAttr = false;
  else data.attrValue = value;
});

/**
 * Raw HTML in a memo, such as a `<details>` section or a trusted video embed, as the memo
 * view shows it: the editor's `sanitizeHtml`. Gets the HTML parsed into a fragment that is
 * not in the page and removes, in place, what memos does not allow; text stays, so the
 * Markdown between the tags, which the editor renders itself, keeps its place.
 */
export function sanitizeMemoHtml(tree: DocumentFragment): DocumentFragment {
  normalizeSources(tree);
  // DOMPurify sanitizes an element in place, not a fragment, so the tree goes into one for the pass.
  const root = (tree.ownerDocument ?? document).createElement("div");
  root.append(tree);
  purify.sanitize(root, { ALLOWED_TAGS, ALLOWED_ATTR: ALLOWED_ATTRIBUTES, IN_PLACE: true });
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!finishElement(element)) element.remove();
  }
  tree.append(...root.childNodes);
  return tree;
}

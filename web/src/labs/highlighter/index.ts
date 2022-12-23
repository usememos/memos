import { escape } from "lodash";

const walkthroughNodeWithKeyword = (node: HTMLElement, keyword: string) => {
  if (node.nodeType === 3) {
    const span = document.createElement("span");
    span.innerHTML = node.nodeValue?.replace(new RegExp(keyword, "g"), `<mark>${keyword}</mark>`) ?? "";
    node.parentNode?.insertBefore(span, node);
    node.parentNode?.removeChild(node);
  }
  for (const child of Array.from(node.childNodes)) {
    walkthroughNodeWithKeyword(<HTMLElement>child, keyword);
  }
  return node.innerHTML;
};

export const highlightWithWord = (html: string, keyword?: string): string => {
  if (!keyword) {
    return html;
  }
  keyword = escape(keyword);
  const wrap = document.createElement("div");
  wrap.innerHTML = escape(html);
  return walkthroughNodeWithKeyword(wrap, keyword);
};

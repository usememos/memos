const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

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
  keyword = escapeRegExp(keyword);
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return walkthroughNodeWithKeyword(wrap, keyword);
};

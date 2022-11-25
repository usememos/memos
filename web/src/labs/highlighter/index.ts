const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

function dfsAndHighlight(node: HTMLElement, keyword: string) {
  if (node.nodeType === 3) {
    const span = document.createElement("span");
    span.innerHTML = node.nodeValue?.replace(new RegExp(keyword, "g"), `<mark>${keyword}</mark>`) ?? "";
    node.parentNode?.insertBefore(span, node);
    node.parentNode?.removeChild(node);
  }
  for (const child of node.childNodes) {
    dfsAndHighlight(<HTMLElement>child, keyword);
  }
  return node.innerHTML;
}

const highlightWithWord = (html: string, keyword: string | undefined): string => {
  if (!keyword) {
    return html;
  }
  keyword = escapeRegExp(keyword);
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return dfsAndHighlight(wrap, keyword);
};

export default highlightWithWord;

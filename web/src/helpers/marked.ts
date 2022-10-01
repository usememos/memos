import { escape } from "lodash-es";

const CODE_BLOCK_REG = /```([\s\S]*?)```\n?/g;
const BOLD_TEXT_REG = /\*\*(.+?)\*\*/g;
const EM_TEXT_REG = /\*(.+?)\*/g;
const DOT_LI_REG = /[*-] /g;
const NUM_LI_REG = /(\d+)\. /g;
export const TODO_BLOCK_REG = /- \[ \] /g;
export const DONE_BLOCK_REG = /- \[x\] /g;
// tag regex
export const TAG_REG = /#([^\s#]+?) /g;
// markdown image regex
export const IMAGE_URL_REG = /!\[.*?\]\((.+?)\)\n?/g;
// markdown link regex
export const LINK_URL_REG = /\[(.*?)\]\((.+?)\)/g;
// linked memo regex
export const MEMO_LINK_REG = /@\[(.+?)\]\((.+?)\)/g;

const parseMarkedToHtml = (markedStr: string): string => {
  const htmlText = markedStr
    .replace(CODE_BLOCK_REG, "<pre lang=''>$1</pre>")
    .replace(TODO_BLOCK_REG, "<span class='todo-block todo' data-value='TODO'></span>")
    .replace(DONE_BLOCK_REG, "<span class='todo-block done' data-value='DONE'>✓</span>")
    .replace(DOT_LI_REG, "<span class='counter-block'>•</span>")
    .replace(NUM_LI_REG, "<span class='counter-block'>$1.</span>")
    .replace(BOLD_TEXT_REG, "<strong>$1</strong>")
    .replace(EM_TEXT_REG, "<em>$1</em>");
  return htmlText;
};

const parseHtmlToRawText = (htmlStr: string): string => {
  const tempEl = document.createElement("div");
  tempEl.className = "memo-content-text";
  tempEl.innerHTML = htmlStr;
  const text = tempEl.innerText;
  return text;
};

const formatMemoContent = (content: string) => {
  const tempElement = document.createElement("div");
  tempElement.innerHTML = parseMarkedToHtml(escape(content));

  return tempElement.innerHTML
    .replace(IMAGE_URL_REG, "<img class='img' src='$1' />")
    .replace(MEMO_LINK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>")
    .replace(LINK_URL_REG, "<a class='link' target='_blank' rel='noreferrer' href='$2'>$1</a>")
    .replace(TAG_REG, "<span class='tag-span'>#$1</span> ");
};

export { formatMemoContent, parseHtmlToRawText };

import { escape } from "lodash-es";
import { IMAGE_URL_REG, LINK_URL_REG, MEMO_LINK_REG, TAG_REG } from "./consts";

const CODE_BLOCK_REG = /```([\s\S]*?)```/g;
const BOLD_TEXT_REG = /\*\*(.+?)\*\*/g;
const EM_TEXT_REG = /\*(.+?)\*/g;
export const TODO_BLOCK_REG = /- \[ \] /g;
export const DONE_BLOCK_REG = /- \[x\] /g;
const DOT_LI_REG = /[*-] /g;
const NUM_LI_REG = /(\d+)\. /g;

const parseMarkedToHtml = (markedStr: string): string => {
  const htmlText = markedStr
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9?.,;[\]]+)/g, "$1 $2")
    .replace(/([A-Za-z0-9?.,;[\]]+)([\u4e00-\u9fa5])/g, "$1 $2")
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

interface FormatterConfig {
  inlineImage: boolean;
}
const defaultFormatterConfig: FormatterConfig = {
  inlineImage: false,
};

const formatMemoContent = (content: string, addtionConfig?: Partial<FormatterConfig>) => {
  const config = {
    ...defaultFormatterConfig,
    ...addtionConfig,
  };
  const tempElement = document.createElement("div");
  tempElement.innerHTML = parseMarkedToHtml(escape(content));

  let outputString = tempElement.innerHTML;
  if (config.inlineImage) {
    outputString = outputString.replace(IMAGE_URL_REG, "<img class='img' src='$1' />");
  } else {
    outputString = outputString.replace(IMAGE_URL_REG, "");
  }

  return outputString
    .replace(MEMO_LINK_REG, "<span class='memo-link-text' data-value='$2'>$1</span>")
    .replace(LINK_URL_REG, "<a class='link' target='_blank' rel='noreferrer' href='$2'>$1</a>")
    .replace(TAG_REG, "<span class='tag-span'>#$1</span> ");
};

export { formatMemoContent, parseHtmlToRawText };

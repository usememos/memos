import { escape } from "lodash-es";
import { marked } from "marked";

export const TAG_REG = /#([^\s#]+?) /g;
// markdown image regex
export const IMAGE_URL_REG = /!\[.*?\]\((.+?)\)\n?/g;
// markdown link regex
export const LINK_URL_REG = /\[(.*?)\]\((.+?)\)/g;
// linked memo regex
export const MEMO_LINK_REG = /@\[(.+?)\]\((.+?)\)/g;

const parseMarkedToHtml = (markedStr: string): string => {
  marked.setOptions({ gfm: true });
  return marked.parse(markedStr);
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

const formatMemoContent = (content: string, additionConfig?: Partial<FormatterConfig>) => {
  const config = {
    ...defaultFormatterConfig,
    ...additionConfig,
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

import { inlineElementParserList } from ".";
import { marked } from "..";

export const DONE_LIST_REG = /^- \[[xX]\] ([^\n]+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(DONE_LIST_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const matchResult = matcher(rawStr);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return `<p class='li-container'><span class='todo-block done' data-value='DONE'>✓</span><span>${parsedContent}</span></p>`;
};

export default {
  name: "done list",
  regex: DONE_LIST_REG,
  matcher,
  renderer,
};

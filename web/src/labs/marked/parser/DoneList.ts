import { inlineElementParserList } from ".";
import { marked } from "..";

export const DONE_LIST_REG = /^- \[x\] (.+)(\n?)/;

const renderer = (rawStr: string, highlightWord: string | undefined): string => {
  const matchResult = rawStr.match(DONE_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], highlightWord, [], inlineElementParserList);
  return `<p><span class='todo-block done' data-value='DONE'>✓</span>${parsedContent}</p>${matchResult[2]}`;
};

export default {
  name: "done list",
  regex: DONE_LIST_REG,
  renderer,
};

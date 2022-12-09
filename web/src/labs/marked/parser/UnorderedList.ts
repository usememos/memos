import { escape } from "lodash-es";
import { inlineElementParserList } from ".";
import { marked } from "..";

export const UNORDERED_LIST_REG = /^[*-] (.+)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(UNORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return `<p class='li-container'><span class='ul-block'>•</span>${parsedContent}</p>${escape(matchResult[2])}`;
};

export default {
  name: "unordered list",
  regex: UNORDERED_LIST_REG,
  renderer,
};

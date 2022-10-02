import { inlineElementParserList } from ".";
import { marked } from "..";

export const UNORDERED_LIST_REG = /^[*-] ([\S ]+)(\n?)/;

const match = (rawStr: string): number => {
  const matchResult = rawStr.match(UNORDERED_LIST_REG);
  if (!matchResult) {
    return 0;
  }

  const matchStr = matchResult[0];
  return matchStr.length;
};

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(UNORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], inlineElementParserList);
  return `<p><span class='ul-block'>•</span>${parsedContent}</p>${matchResult[2]}`;
};

export default {
  name: "unordered list",
  regex: UNORDERED_LIST_REG,
  match,
  renderer,
};

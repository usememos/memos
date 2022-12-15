import { inlineElementParserList } from ".";
import { marked } from "..";

export const ORDERED_LIST_REG = /^(\d+)\. (.+)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(ORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[2], [], inlineElementParserList);
  return `<p class='li-container'><span class='ol-block'>${matchResult[1]}.</span><span>${parsedContent}</span></p>${matchResult[3]}`;
};

export default {
  name: "ordered list",
  regex: ORDERED_LIST_REG,
  renderer,
};

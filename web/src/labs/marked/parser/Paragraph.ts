import { inlineElementParserList } from ".";
import { marked } from "..";

export const PARAGRAPH_REG = /^([^\n]+)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(PARAGRAPH_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  const parsedContent = marked(rawStr, [], inlineElementParserList);
  return `<p>${parsedContent}</p>`;
};

export default {
  name: "paragraph",
  regex: PARAGRAPH_REG,
  matcher,
  renderer,
};

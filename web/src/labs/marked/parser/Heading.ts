import { inlineElementParserList } from ".";
import { marked } from "..";

export const HEADING_REG = /^# (.*)/;

const matcher = (rawStr: string) => {
  const matchResult = rawStr.match(HEADING_REG);
  return matchResult;
};

const renderer = (rawStr: string): string => {
  console.log(rawStr);
  const parsedContent = marked(rawStr, [], inlineElementParserList);
  return `<h1>${parsedContent}</h1>`;
};

export default {
  name: "heading",
  regex: HEADING_REG,
  matcher,
  renderer,
};

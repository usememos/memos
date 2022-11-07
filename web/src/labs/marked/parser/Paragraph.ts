import { inlineElementParserList } from ".";
import { marked } from "..";

// \u3000: full-width space

export const PARAGRAPH_REG = /^([\S \u3000]*)(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(PARAGRAPH_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineElementParserList);
  return `<p>${parsedContent}</p>${matchResult[2]}`;
};

export default {
  name: "ordered list",
  regex: PARAGRAPH_REG,
  renderer,
};

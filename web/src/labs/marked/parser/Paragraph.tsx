import { inlineElementParserList, inlineElementParserListNonInteractive } from ".";
import { marked } from "..";
import type { Parser } from "./Parser";

export const PARAGRAPH_REG = /^([^\n]+)/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const parsedContent = marked(rawStr, [], inlineParsers);
  return <p>{parsedContent}</p>;
};

export default {
  name: "paragraph",
  regexp: PARAGRAPH_REG,
  renderer: () => renderer(inlineElementParserList),
};

export const ParagraphNonInteractive = {
  name: "paragraph non-interactive",
  regexp: PARAGRAPH_REG,
  renderer: () => renderer(inlineElementParserListNonInteractive),
};

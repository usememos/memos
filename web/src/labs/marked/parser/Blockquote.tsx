import { inlineElementParserList, inlineElementParserListNonInteractive } from ".";
import { marked } from "..";
import { matcher } from "../matcher";
import { Parser } from "./Parser";

export const BLOCKQUOTE_REG = /^> ([^\n]+)/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, BLOCKQUOTE_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  const parsedContent = marked(matchResult[1], [], inlineParsers);
  return <blockquote>{parsedContent}</blockquote>;
};

export default {
  name: "blockquote",
  regexp: BLOCKQUOTE_REG,
  renderer: () => renderer(inlineElementParserList),
};

export const BlockquoteNonInteractive = {
  name: "blockquote non-interactive",
  regexp: BLOCKQUOTE_REG,
  renderer: () => renderer(inlineElementParserListNonInteractive),
};

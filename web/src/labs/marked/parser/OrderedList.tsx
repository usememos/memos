import { inlineElementParserList, inlineElementParserListNonInteractive } from ".";
import { marked } from "..";
import { matcher } from "../matcher";
import type { Parser } from "./Parser";

export const ORDERED_LIST_REG = /^( *)(\d+)\. (.+)/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, ORDERED_LIST_REG);
  if (!matchResult) {
    return rawStr;
  }
  const space = matchResult[1];
  const parsedContent = marked(matchResult[3], [], inlineParsers);
  return (
    <p className="li-container">
      <span className="whitespace-pre">{space}</span>
      <span className="ol-block">{matchResult[2]}.</span>
      <span>{parsedContent}</span>
    </p>
  );
};

export default {
  name: "ordered list",
  regexp: ORDERED_LIST_REG,
  renderer: () => renderer(inlineElementParserList),
};

export const OrderedListNonInteractive = {
  name: "ordered list non-interactive",
  regexp: ORDERED_LIST_REG,
  renderer: () => renderer(inlineElementParserListNonInteractive),
};

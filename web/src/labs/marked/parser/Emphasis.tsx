import { marked } from "..";
import { matcher } from "../matcher";
import Link, { LinkNonInteractive } from "./Link";
import PlainLink, { PlainLinkNonInteractive } from "./PlainLink";
import PlainText from "./PlainText";
import type { Parser } from "./Parser";

export const EMPHASIS_REG = /\*(.+?)\*/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineParsers);
  return <em>{parsedContent}</em>;
};

export default {
  name: "emphasis",
  regexp: EMPHASIS_REG,
  renderer: () => renderer([Link, PlainLink, PlainText]),
};

export const EmphasisNonInteractive = {
  name: "emphasis non-interactive",
  regexp: EMPHASIS_REG,
  renderer: () => renderer([LinkNonInteractive, PlainLinkNonInteractive, PlainText]),
};

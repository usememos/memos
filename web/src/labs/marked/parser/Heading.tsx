import { marked } from "..";
import { matcher } from "../matcher";
import Link, { LinkNonInteractive } from "./Link";
import PlainLink, { PlainLinkNonInteractive } from "./PlainLink";
import PlainText from "./PlainText";
import type { Parser } from "./Parser";

export const HEADING_REG = /^(#+) ([^\n]+)/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, HEADING_REG);
  if (!matchResult) {
    return rawStr;
  }

  const level = matchResult[1].length;
  const parsedContent = marked(matchResult[2], [], inlineParsers);
  if (level === 1) {
    return <h1>{parsedContent}</h1>;
  } else if (level === 2) {
    return <h2>{parsedContent}</h2>;
  } else if (level === 3) {
    return <h3>{parsedContent}</h3>;
  } else if (level === 4) {
    return <h4>{parsedContent}</h4>;
  }
  return <h5>{parsedContent}</h5>;
};

export default {
  name: "heading",
  regexp: HEADING_REG,
  renderer: () => renderer([Link, PlainLink, PlainText]),
};

export const HeadingNonInteractive = {
  name: "heading non-interactive",
  regexp: HEADING_REG,
  renderer: () => renderer([LinkNonInteractive, PlainLinkNonInteractive, PlainText]),
};

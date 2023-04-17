import { marked } from "..";
import { matcher } from "../matcher";
import Link, { LinkNonInteractive } from "./Link";
import PlainText from "./PlainText";
import PlainLink, { PlainLinkNonInteractive } from "./PlainLink";
import { Parser } from "./Parser";

export const BOLD_EMPHASIS_REG = /\*\*\*(.+?)\*\*\*/;

// eslint-disable-next-line react/display-name
const renderer = (inlineParsers: Parser[]) => (rawStr: string) => {
  const matchResult = matcher(rawStr, BOLD_EMPHASIS_REG);
  if (!matchResult) {
    return rawStr;
  }

  const parsedContent = marked(matchResult[1], [], inlineParsers);
  return (
    <strong>
      <em>{parsedContent}</em>
    </strong>
  );
};

export default {
  name: "bold emphasis",
  regexp: BOLD_EMPHASIS_REG,
  renderer: () => renderer([Link, PlainLink, PlainText]),
};

export const BoldEmphasisNonInteractive = {
  name: "bold emphasis non-interactive",
  regexp: BOLD_EMPHASIS_REG,
  renderer: () => renderer([LinkNonInteractive, PlainLinkNonInteractive, PlainText]),
};

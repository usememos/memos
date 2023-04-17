import Emphasis, { EmphasisNonInteractive } from "./Emphasis";
import Bold, { BoldNonInteractive } from "./Bold";
import { marked } from "..";
import InlineCode from "./InlineCode";
import BoldEmphasis, { BoldEmphasisNonInteractive } from "./BoldEmphasis";
import PlainText from "./PlainText";
import { matcher } from "../matcher";

export const LINK_REG = /\[([^\]]+)\]\(([^)]+)\)/;

const renderer = (rawStr: string) => {
  const matchResult = matcher(rawStr, LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(matchResult[1], [], [InlineCode, BoldEmphasis, Emphasis, Bold, PlainText]);
  return (
    <a className="link" target="_blank" href={matchResult[2]}>
      {parsedContent}
    </a>
  );
};

const rendererNonInteractive = (rawStr: string) => {
  const matchResult = matcher(rawStr, LINK_REG);
  if (!matchResult) {
    return rawStr;
  }
  const parsedContent = marked(
    matchResult[1],
    [],
    [InlineCode, BoldEmphasisNonInteractive, EmphasisNonInteractive, BoldNonInteractive, PlainText]
  );
  return <span className="link">{parsedContent}</span>;
};

export default {
  name: "link",
  regexp: LINK_REG,
  renderer: () => renderer,
};

export const LinkNonInteractive = {
  name: "link non-interactive",
  regexp: LINK_REG,
  renderer: () => rendererNonInteractive,
};
